"""Conexión a Postgres y creación idempotente del esquema `ai`."""

from __future__ import annotations

import logging

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

log = logging.getLogger(__name__)


def _schema_statements(dim: int) -> list[str]:
    return [
        "CREATE EXTENSION IF NOT EXISTS vector",
        "CREATE SCHEMA IF NOT EXISTS ai",
        f"""
        CREATE TABLE IF NOT EXISTS ai.chunks (
          id             bigserial PRIMARY KEY,
          source_type    text NOT NULL,
          source_id      text NOT NULL,
          project_id     integer,
          document_title text NOT NULL,
          document_type  text NOT NULL,
          section        text,
          page           integer,
          chunk_index    integer NOT NULL,
          content        text NOT NULL,
          content_hash   text NOT NULL,
          role_access    text[] NOT NULL DEFAULT '{{}}',
          visibility     text NOT NULL DEFAULT 'institutional',
          embedding      vector({dim}) NOT NULL,
          created_at     timestamptz NOT NULL DEFAULT now(),
          updated_at     timestamptz NOT NULL DEFAULT now(),
          UNIQUE (source_type, source_id, chunk_index)
        )
        """,
        """
        ALTER TABLE ai.chunks
          ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'institutional'
        """,
        """
        CREATE INDEX IF NOT EXISTS chunks_role_access
          ON ai.chunks USING gin (role_access)
        """,
    ]


async def create_pool(database_url: str) -> AsyncConnectionPool:
    # Neon (serverless) puede tardar en despertar: se limita cada intento de
    # conexión y se espera más tiempo a que el pool tenga su primera conexión.
    conninfo = database_url
    if "connect_timeout=" not in conninfo:
        separator = "&" if "?" in conninfo else "?"
        conninfo = f"{conninfo}{separator}connect_timeout=10"

    pool = AsyncConnectionPool(
        conninfo=conninfo,
        min_size=1,
        max_size=5,
        open=False,
        kwargs={"row_factory": dict_row},
    )
    await pool.open()
    await pool.wait(timeout=45)
    return pool


async def init_schema(pool: AsyncConnectionPool, dim: int) -> None:
    """Crea extensión, esquema y tabla. El índice HNSW es opcional."""

    async with pool.connection() as conn:
        for statement in _schema_statements(dim):
            async with conn.transaction():
                await conn.execute(statement)

        try:
            async with conn.transaction():
                await conn.execute(
                    """
                    CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
                      ON ai.chunks USING hnsw (embedding vector_cosine_ops)
                    """
                )
        except Exception as exc:  # noqa: BLE001 - pgvector viejo o sin permisos
            log.warning(
                "No se pudo crear el índice HNSW (se usará scan secuencial): %s",
                exc,
            )
