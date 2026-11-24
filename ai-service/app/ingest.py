"""Ingesta de la tabla `Document` hacia `ai.chunks`.

Uso:

    python -m app.ingest --all
    python -m app.ingest --document <uuid>

El script es idempotente: cada documento reemplaza sus propios fragmentos.
No toca `Document` ni `ProjectDocument`; solo lee.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import sys
from dataclasses import dataclass

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import Settings, get_settings
from .db import create_pool, init_schema
from .factory import build_ollama
from .ollama import OllamaClient
from .retrieval import to_pgvector

log = logging.getLogger("athenea.ingest")

# Roles legacy que pueden existir en `Document.roleAccess` y su equivalente
# actual en el enum `Role` de Prisma.
ROLE_ALIASES: dict[str, str] = {
    "ADMIN": "ADMINISTRATOR",
    "ADMINISTRADOR": "ADMINISTRATOR",
    "ADMINISTRATION": "ADMINISTRATOR",
    "MANAGER": "COORDINATOR",
    "COORDINADOR": "COORDINATOR",
    "COORDINATION": "COORDINATOR",
    "EVALUATOR": "COMMITTEE",
    "REVIEWER": "COMMITTEE",
    "COMITE": "COMMITTEE",
    "COMITÉ": "COMMITTEE",
    "INVESTIGATOR": "PRINCIPAL_INVESTIGATOR",
    "RESEARCHER": "PRINCIPAL_INVESTIGATOR",
    "PI": "PRINCIPAL_INVESTIGATOR",
    "PRINCIPAL": "PRINCIPAL_INVESTIGATOR",
    "ESTUDIANTE": "STUDENT",
    "ALUMNO": "STUDENT",
    "STUDENTS": "STUDENT",
}

VALID_ROLES = {
    "STUDENT",
    "PRINCIPAL_INVESTIGATOR",
    "COORDINATOR",
    "COMMITTEE",
    "ADMINISTRATOR",
}


def normalize_roles(roles: list[str] | None) -> list[str]:
    """Convierte roles legacy a los roles actuales y descarta desconocidos.

    Una lista vacía significa "visible para cualquier usuario autenticado",
    que es la misma semántica que ya usa la UI para documentos públicos.
    """

    if not roles:
        return []

    normalized: list[str] = []
    for raw in roles:
        if not isinstance(raw, str):
            continue
        value = raw.strip().upper().replace(" ", "_").replace("-", "_")
        value = ROLE_ALIASES.get(value, value)
        if value not in VALID_ROLES:
            log.warning("Rol desconocido en roleAccess, se ignora: %r", raw)
            continue
        if value not in normalized:
            normalized.append(value)
    return normalized


def chunk_text(text: str, size: int, overlap: int) -> list[str]:
    """Divide en fragmentos respetando párrafos y sin cortar palabras."""

    clean = text.replace("\r\n", "\n").strip()
    if not clean:
        return []

    size = max(200, size)
    overlap = max(0, min(overlap, size // 2))

    paragraphs = [p.strip() for p in clean.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for paragraph in paragraphs:
        # Un párrafo más grande que el límite se parte por oraciones.
        if len(paragraph) > size:
            flush()
            chunks.extend(_split_long(paragraph, size, overlap))
            continue

        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) <= size:
            current = candidate
        else:
            flush()
            current = paragraph

    flush()
    return chunks


def _split_long(paragraph: str, size: int, overlap: int) -> list[str]:
    sentences = [
        sentence.strip()
        for sentence in paragraph.replace("\n", " ").split(". ")
        if sentence.strip()
    ]
    if not sentences:
        return [paragraph[index : index + size] for index in range(0, len(paragraph), size)]

    pieces: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= size:
            current = candidate
        else:
            if current:
                pieces.append(current)
                tail = current[-overlap:] if overlap else ""
                current = f"{tail} {sentence}".strip()
            else:
                # Una sola oración gigante: corte duro.
                pieces.extend(
                    paragraph[index : index + size]
                    for index in range(0, len(paragraph), size)
                )
                return pieces
    if current:
        pieces.append(current)
    return pieces


def content_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SourceDocument:
    id: str
    title: str
    content: str
    role_access: list[str]


async def fetch_documents(
    pool: AsyncConnectionPool,
    document_id: str | None,
) -> list[SourceDocument]:
    query = """
        SELECT id, title, content, "roleAccess"
        FROM "Document"
        {where}
        ORDER BY "updatedAt" DESC
    """.format(where='WHERE id = %s' if document_id else "")

    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(query, (document_id,) if document_id else ())
            rows = await cur.fetchall()

    return [
        SourceDocument(
            id=str(row["id"]),
            title=str(row["title"]),
            content=str(row["content"] or ""),
            role_access=list(row["roleAccess"] or []),
        )
        for row in rows
    ]


async def ingest_document(
    pool: AsyncConnectionPool,
    ollama: OllamaClient,
    settings: Settings,
    document: SourceDocument,
) -> int:
    chunks = chunk_text(
        document.content,
        settings.ai_chunk_size,
        settings.ai_chunk_overlap,
    )
    if not chunks:
        log.warning("Documento %s sin contenido: se omiten sus fragmentos.", document.id)
        chunks = []

    roles = normalize_roles(document.role_access)
    log.info(
        "Indexando %s (%s fragmentos, roles=%s)",
        document.title,
        len(chunks),
        roles or "público autenticado",
    )

    rows: list[tuple[object, ...]] = []
    batch_size = max(1, settings.ai_embed_batch_size)

    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        embeddings = await ollama.embed(batch)
        for offset, (chunk, embedding) in enumerate(zip(batch, embeddings, strict=True)):
            rows.append(
                (
                    "institutional_document",
                    document.id,
                    None,
                    document.title,
                    "Documento institucional",
                    None,
                    None,
                    start + offset,
                    chunk,
                    content_hash(chunk),
                    roles,
                    "institutional",
                    to_pgvector(embedding),
                )
            )

    async with pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "DELETE FROM ai.chunks WHERE source_type = %s AND source_id = %s",
                ("institutional_document", document.id),
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


async def ingest_all(
    pool: AsyncConnectionPool,
    ollama: OllamaClient,
    settings: Settings,
) -> tuple[int, int]:
    documents = await fetch_documents(pool, None)
    if not documents:
        log.warning(
            "La tabla Document está vacía: el asistente no tendrá contexto "
            "institucional hasta que se registren documentos."
        )
        return 0, 0

    total_chunks = 0
    for document in documents:
        total_chunks += await ingest_document(pool, ollama, settings, document)
    return len(documents), total_chunks


async def run(document_id: str | None, all_documents: bool) -> int:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    pool = await create_pool(settings.database_url)
    ollama = build_ollama(settings)
    try:
        await init_schema(pool, settings.ai_embedding_dim)

        if all_documents:
            documents, chunks = await ingest_all(pool, ollama, settings)
            log.info("Ingesta completa: %s documentos, %s fragmentos.", documents, chunks)
            return 0

        if not document_id:
            log.error("Indica --all o --document <uuid>.")
            return 2

        found = await fetch_documents(pool, document_id)
        if not found:
            log.error("No existe un Document con id %s.", document_id)
            return 1

        chunks = await ingest_document(pool, ollama, settings, found[0])
        log.info("Documento %s indexado con %s fragmentos.", document_id, chunks)
        return 0
    finally:
        await ollama.aclose()
        await pool.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Indexa documentos institucionales en ai.chunks.",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="Indexa toda la tabla Document.")
    group.add_argument("--document", metavar="UUID", help="Indexa un documento concreto.")
    args = parser.parse_args(argv)

    if sys.platform == "win32":
        policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
        if policy is not None:
            asyncio.set_event_loop_policy(policy())

    return asyncio.run(run(args.document, args.all))


if __name__ == "__main__":
    raise SystemExit(main())
