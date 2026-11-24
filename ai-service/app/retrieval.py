"""Recuperación vectorial con filtro de autorización en SQL."""

from __future__ import annotations

from dataclasses import dataclass

from psycopg_pool import AsyncConnectionPool

from .models import QueryScope

# El filtro se aplica ANTES del ORDER BY para que ningún fragmento no
# autorizado participe en la búsqueda por similitud.
#
# - institutional: documentos globales; visibles según `role_access`
#   (lista vacía = cualquier usuario autenticado).
# - team: documentos de un proyecto; visibles para sus miembros.
# - shared: documentos compartidos con administración; visibles para los
#   miembros del proyecto y para los roles de `role_access`.
RETRIEVAL_SQL = """
SELECT
  id,
  source_type,
  source_id,
  project_id,
  document_title,
  document_type,
  section,
  page,
  content,
  visibility,
  1 - (embedding <=> %(vector)s::vector) AS score
FROM ai.chunks
WHERE (
  (
    visibility = 'institutional'
    AND (role_access = '{}'::text[] OR role_access && %(roles)s::text[])
  )
  OR (
    visibility = 'team'
    AND project_id = ANY(%(projects)s::int[])
  )
  OR (
    visibility = 'shared'
    AND (
      project_id = ANY(%(projects)s::int[])
      OR role_access && %(roles)s::text[]
    )
  )
)
ORDER BY embedding <=> %(vector)s::vector
LIMIT %(limit)s
"""


@dataclass(frozen=True)
class RetrievedChunk:
    id: int
    source_type: str
    source_id: str
    project_id: int | None
    document_title: str
    document_type: str
    section: str | None
    page: int | None
    content: str
    score: float


def to_pgvector(embedding: list[float]) -> str:
    """Serializa el vector para `%s::vector` (sin depender de pgvector-python)."""
    return "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"


async def retrieve(
    pool: AsyncConnectionPool,
    embedding: list[float],
    scope: QueryScope,
    top_k: int,
    min_similarity: float,
) -> list[RetrievedChunk]:
    params = {
        "vector": to_pgvector(embedding),
        "roles": [scope.role],
        "projects": scope.project_ids,
        "limit": top_k,
    }

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(RETRIEVAL_SQL, params)
            rows = await cur.fetchall()

    chunks: list[RetrievedChunk] = []
    for row in rows:
        score = float(row["score"])
        if score < min_similarity:
            continue
        chunks.append(
            RetrievedChunk(
                id=int(row["id"]),
                source_type=str(row["source_type"]),
                source_id=str(row["source_id"]),
                project_id=row["project_id"],
                document_title=str(row["document_title"]),
                document_type=str(row["document_type"]),
                section=row["section"],
                page=row["page"],
                content=str(row["content"]),
                score=score,
            )
        )
    return chunks
