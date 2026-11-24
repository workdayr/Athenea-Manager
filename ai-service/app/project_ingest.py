"""Indexación de los PDFs subidos a proyectos (`ProjectDocument`).

Los archivos viven en el bind mount de Docker (`AI_UPLOAD_DIR`), pero en la
base de datos `file_url` guarda la ruta del contenedor (`/app/uploads/...`).
Aquí se traduce esa ruta a la carpeta real del host antes de leer el PDF.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

from psycopg_pool import AsyncConnectionPool
from pypdf import PdfReader

from .config import Settings
from .ingest import chunk_text, content_hash
from .ollama import OllamaClient
from .retrieval import to_pgvector

log = logging.getLogger("athenea.project_ingest")

CONTAINER_UPLOAD_PREFIX = "/app/uploads"

DOC_TYPE_LABELS: dict[str, str] = {
    "hypothesis": "Hipótesis",
    "abstract": "Resumen",
    "methodology": "Metodología",
    "rationale": "Justificación",
    "results": "Informe de resultados",
    "ethics_approval": "Aprobación de ética",
    "evidence": "Evidencia",
}

# Roles que pueden consultar documentos marcados como compartidos con
# administración, además de los miembros del proyecto.
ADMIN_ROLES = ["COORDINATOR", "ADMINISTRATOR", "COMMITTEE"]

PENDING_SQL = """
SELECT pd.document_id,
       pd.project_id,
       pd.doc_type,
       pd.visibility,
       pd.file_url,
       pd.file_name
  FROM "ProjectDocument" pd
  LEFT JOIN (
    SELECT source_id, max(updated_at) AS indexed_at
      FROM ai.chunks
     WHERE source_type = 'project_document'
     GROUP BY source_id
  ) c ON c.source_id = pd.document_id::text
 WHERE lower(coalesce(pd.file_name, pd.file_url)) LIKE '%.pdf'
   AND NOT (pd.document_id = ANY(%s::int[]))
   AND (c.indexed_at IS NULL OR c.indexed_at < pd.uploaded_at)
 ORDER BY pd.uploaded_at
 LIMIT %s
"""

SINGLE_SQL = """
SELECT document_id,
       project_id,
       doc_type,
       visibility,
       file_url,
       file_name
  FROM "ProjectDocument"
 WHERE document_id = %s
"""


@dataclass(frozen=True)
class ProjectSource:
    document_id: int
    project_id: int
    doc_type: str
    visibility: str
    file_url: str
    file_name: str | None


def resolve_path(file_url: str, upload_dir: str) -> Path:
    """Traduce `/app/uploads/...` a la carpeta real del host."""
    normalized = file_url.replace("\\", "/")
    if normalized.startswith(CONTAINER_UPLOAD_PREFIX + "/"):
        relative = normalized[len(CONTAINER_UPLOAD_PREFIX) + 1 :]
        return Path(upload_dir) / relative
    return Path(normalized)


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:  # noqa: BLE001 - una página dañada no invalida el PDF
            continue
        if text.strip():
            parts.append(text.strip())
    return "\n\n".join(parts)


def visibility_config(visibility: str) -> tuple[str, list[str]]:
    if visibility == "Shared_with_administration":
        return "shared", list(ADMIN_ROLES)
    return "team", []


async def fetch_pending(
    pool: AsyncConnectionPool,
    limit: int = 20,
    exclude: list[int] | None = None,
) -> list[ProjectSource]:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(PENDING_SQL, (exclude or [], limit))
            rows = await cur.fetchall()

    return [
        ProjectSource(
            document_id=int(row["document_id"]),
            project_id=int(row["project_id"]),
            doc_type=str(row["doc_type"]),
            visibility=str(row["visibility"]),
            file_url=str(row["file_url"]),
            file_name=row["file_name"],
        )
        for row in rows
    ]


async def fetch_one(
    pool: AsyncConnectionPool,
    document_id: int,
) -> ProjectSource | None:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(SINGLE_SQL, (document_id,))
            row = await cur.fetchone()

    if not row:
        return None
    return ProjectSource(
        document_id=int(row["document_id"]),
        project_id=int(row["project_id"]),
        doc_type=str(row["doc_type"]),
        visibility=str(row["visibility"]),
        file_url=str(row["file_url"]),
        file_name=row["file_name"],
    )


async def ingest_project_document(
    pool: AsyncConnectionPool,
    ollama: OllamaClient,
    settings: Settings,
    source: ProjectSource,
) -> int:
    path = resolve_path(source.file_url, settings.ai_upload_dir)
    if not path.is_file():
        log.warning(
            "PDF no encontrado para ProjectDocument %s: %s",
            source.document_id,
            path,
        )
        return 0

    try:
        text = await asyncio.to_thread(extract_pdf_text, path)
    except Exception as exc:  # noqa: BLE001 - un PDF corrupto no frena el sync
        log.warning("No se pudo leer el PDF %s: %s", path, exc)
        return 0

    if not text.strip():
        log.warning(
            "El PDF %s no tiene texto extraíble (¿escaneado sin OCR?).",
            path,
        )
        return 0

    chunks = chunk_text(
        text,
        settings.ai_chunk_size,
        settings.ai_chunk_overlap,
    )
    if not chunks:
        return 0

    visibility, roles = visibility_config(source.visibility)
    title = source.file_name or (
        f"{DOC_TYPE_LABELS.get(source.doc_type, source.doc_type)} "
        f"del proyecto {source.project_id}"
    )
    document_type = DOC_TYPE_LABELS.get(source.doc_type, source.doc_type)

    log.info(
        "Indexando PDF %s (%s fragmentos, visibilidad=%s)",
        title,
        len(chunks),
        visibility,
    )

    rows: list[tuple[object, ...]] = []
    batch_size = max(1, settings.ai_embed_batch_size)
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        embeddings = await ollama.embed(batch)
        for offset, (chunk, embedding) in enumerate(zip(batch, embeddings, strict=True)):
            rows.append(
                (
                    "project_document",
                    str(source.document_id),
                    source.project_id,
                    title,
                    document_type,
                    None,
                    None,
                    start + offset,
                    chunk,
                    content_hash(chunk),
                    roles,
                    visibility,
                    to_pgvector(embedding),
                )
            )

    async with pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "DELETE FROM ai.chunks WHERE source_type = %s AND source_id = %s",
                ("project_document", str(source.document_id)),
            )
            if rows:
                async with conn.cursor() as cur:
                    await cur.executemany(
                        """
                        INSERT INTO ai.chunks (
                          source_type, source_id, project_id, document_title,
                          document_type, section, page, chunk_index, content,
                          content_hash, role_access, visibility, embedding
                        ) VALUES (
                          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector
                        )
                        """,
                        rows,
                    )

    return len(rows)


async def sync_project_documents(
    pool: AsyncConnectionPool,
    ollama: OllamaClient,
    settings: Settings,
    max_documents: int = 200,
) -> int:
    """Indexa los PDFs nuevos o modificados. Devuelve cuántos se procesaron."""
    processed = 0
    attempted: list[int] = []
    while processed < max_documents:
        pending = await fetch_pending(pool, limit=10, exclude=attempted)
        if not pending:
            break
        for source in pending:
            attempted.append(source.document_id)
            try:
                await ingest_project_document(pool, ollama, settings, source)
            except Exception:  # noqa: BLE001 - continúa con el siguiente
                log.exception(
                    "Error indexando ProjectDocument %s",
                    source.document_id,
                )
            processed += 1
    return processed
