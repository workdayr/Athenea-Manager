"""API HTTP del microservicio RAG de Athenea Manager.

Endpoints:
  GET  /health      estado del servicio (sin token, sin datos sensibles)
  POST /v1/query    consulta RAG con alcance autorizado
  POST /v1/ingest   reindexa la tabla Document

Autenticación servicio-a-servicio: cabecera `X-AI-Token`.
"""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager, suppress
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .db import create_pool, init_schema
from .factory import build_ollama
from .generation import BLOCKED_TEXT, generate_answer, is_injection, refusal
from .ingest import fetch_documents, ingest_all, ingest_document
from .models import IngestRequest, IngestResponse, QueryRequest, QueryResponse
from .ollama import OllamaError
from .project_ingest import (
    fetch_one as fetch_project_document,
    ingest_project_document,
    sync_project_documents,
)
from .retrieval import retrieve

log = logging.getLogger("athenea.ai")

BUCKETS: dict[str, deque[float]] = defaultdict(deque)


async def _sync_loop(app: FastAPI) -> None:
    """Indexa periódicamente los PDFs nuevos subidos a proyectos."""
    settings: Settings = app.state.settings
    while True:
        try:
            processed = await sync_project_documents(
                app.state.pool,
                app.state.ollama,
                settings,
            )
            if processed:
                log.info("Sync de PDFs: %s documentos procesados.", processed)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - el sync nunca tumba el servicio
            log.exception("Error en el sync de PDFs de proyectos.")
        await asyncio.sleep(settings.ai_sync_interval_s)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    pool = await create_pool(settings.database_url)
    schema_ready = True
    try:
        await init_schema(pool, settings.ai_embedding_dim)
    except Exception as exc:  # noqa: BLE001 - se reporta en /health
        schema_ready = False
        log.error("No se pudo preparar el esquema ai: %s", exc)

    ollama = build_ollama(settings)
    app.state.settings = settings
    app.state.pool = pool
    app.state.ollama = ollama
    app.state.schema_ready = schema_ready

    log.info(
        "ai-service listo en %s:%s (chat=%s, embeddings=%s, dim=%s)",
        settings.ai_service_host,
        settings.ai_service_port,
        settings.ai_chat_model,
        settings.ai_embedding_model,
        settings.ai_embedding_dim,
    )

    sync_task: asyncio.Task[None] | None = None
    if settings.ai_sync_interval_s > 0:
        sync_task = asyncio.create_task(_sync_loop(app))

    try:
        yield
    finally:
        if sync_task is not None:
            sync_task.cancel()
            with suppress(asyncio.CancelledError):
                await sync_task
        await ollama.aclose()
        await pool.close()


app = FastAPI(
    title="Athenea AI Service",
    description="RAG local sobre documentos institucionales autorizados.",
    version="0.1.0",
    lifespan=lifespan,
)


def require_token(
    request: Request,
    x_ai_token: Annotated[str | None, Header(alias="X-AI-Token")] = None,
) -> None:
    expected: str = request.app.state.settings.ai_service_token
    if not x_ai_token or not secrets.compare_digest(x_ai_token, expected):
        raise HTTPException(status_code=401, detail="Token de servicio inválido.")


def enforce_rate_limit(request: Request, key: str) -> None:
    settings: Settings = request.app.state.settings
    limit = settings.ai_rate_limit_per_minute
    if limit <= 0:
        return

    bucket = BUCKETS[key]
    now = time.monotonic()
    while bucket and now - bucket[0] > 60.0:
        bucket.popleft()
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Demasiadas consultas en poco tiempo. Intenta de nuevo en un minuto.",
        )
    bucket.append(now)


@app.exception_handler(OllamaError)
async def ollama_error_handler(_: Request, exc: OllamaError) -> JSONResponse:
    log.error("Fallo de Ollama: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "El modelo local no está disponible. Revisa Ollama."},
    )


@app.get("/health")
async def health(request: Request) -> dict[str, Any]:
    settings: Settings = request.app.state.settings
    ollama = request.app.state.ollama
    pool = request.app.state.pool

    ollama_ok = await ollama.ping()
    models = await ollama.list_models() if ollama_ok else []
    chunk_count: int | None = None

    if request.app.state.schema_ready:
        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT count(*) AS total FROM ai.chunks")
                    row = await cur.fetchone()
                    chunk_count = int(row["total"]) if row else 0
        except Exception as exc:  # noqa: BLE001 - health no debe romperse
            log.warning("No se pudo contar ai.chunks: %s", exc)

    return {
        "status": "ok" if ollama_ok and request.app.state.schema_ready else "degraded",
        "ollama": ollama_ok,
        "schema": request.app.state.schema_ready,
        "chatModel": settings.ai_chat_model,
        "chatModelPresent": settings.ai_chat_model in models,
        "embeddingModel": settings.ai_embedding_model,
        "embeddingModelPresent": settings.ai_embedding_model in models,
        "chunks": chunk_count,
    }


@app.post(
    "/v1/query",
    response_model=QueryResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_token)],
)
async def query(payload: QueryRequest, request: Request) -> QueryResponse:
    enforce_rate_limit(request, f"query:{payload.scope.user_id}")

    if is_injection(payload.question):
        return refusal("blocked", BLOCKED_TEXT)

    settings: Settings = request.app.state.settings
    ollama = request.app.state.ollama
    pool = request.app.state.pool

    embedding = (await ollama.embed([payload.question]))[0]
    chunks = await retrieve(
        pool,
        embedding,
        payload.scope,
        top_k=payload.top_k or settings.ai_top_k,
        min_similarity=settings.ai_min_similarity,
    )

    if not chunks:
        return refusal("no_authorized_context")

    return await generate_answer(ollama, payload.question, payload.history, chunks)


@app.post(
    "/v1/ingest",
    response_model=IngestResponse,
    response_model_by_alias=True,
    dependencies=[Depends(require_token)],
)
async def ingest(payload: IngestRequest, request: Request) -> IngestResponse:
    enforce_rate_limit(request, "ingest")
    settings: Settings = request.app.state.settings
    ollama = request.app.state.ollama
    pool = request.app.state.pool

    if not request.app.state.schema_ready:
        raise HTTPException(status_code=503, detail="El esquema ai no está disponible.")

    if payload.project_document_id is not None:
        source = await fetch_project_document(pool, payload.project_document_id)
        if source is None:
            raise HTTPException(
                status_code=404,
                detail="Documento de proyecto no encontrado.",
            )
        chunks = await ingest_project_document(pool, ollama, settings, source)
        return IngestResponse(documents=1, chunks=chunks)

    if payload.all_documents:
        documents, chunks = await ingest_all(pool, ollama, settings)
        processed = await sync_project_documents(pool, ollama, settings)
        return IngestResponse(documents=documents + processed, chunks=chunks)

    if not payload.document_id:
        raise HTTPException(
            status_code=400,
            detail="Indica documentId, projectDocumentId o all=true.",
        )

    found = await fetch_documents(pool, payload.document_id)
    if not found:
        raise HTTPException(status_code=404, detail="Documento no encontrado.")

    chunks = await ingest_document(pool, ollama, settings, found[0])
    return IngestResponse(documents=1, chunks=chunks)


def run() -> None:
    import asyncio
    import sys

    import uvicorn

    settings = get_settings()
    config = uvicorn.Config(
        "app.main:app",
        host=settings.ai_service_host,
        port=settings.ai_service_port,
        log_level=settings.log_level.lower(),
    )
    server = uvicorn.Server(config)

    if sys.platform == "win32":
        # psycopg async no soporta ProactorEventLoop (el default de uvicorn
        # en Windows). Se arranca uvicorn sobre un SelectorEventLoop.
        asyncio.run(server.serve(), loop_factory=asyncio.SelectorEventLoop)
    else:
        server.run()


if __name__ == "__main__":
    run()
