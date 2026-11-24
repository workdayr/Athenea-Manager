"""Cliente mínimo de Ollama: embeddings y chat con salida JSON."""

from __future__ import annotations

from typing import Any

import httpx


class OllamaError(RuntimeError):
    """Error de comunicación o de contrato con Ollama."""


class OllamaClient:
    def __init__(
        self,
        *,
        base_url: str,
        chat_model: str,
        embedding_model: str,
        embedding_dim: int,
        timeout_s: float,
        temperature: float,
        max_tokens: int,
        context_length: int,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout_s,
        )
        self.chat_model = chat_model
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.context_length = context_length

    async def aclose(self) -> None:
        await self._client.aclose()

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = await self._client.post(
                "/api/embed",
                json={"model": self.embedding_model, "input": texts},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaError(f"Ollama /api/embed falló: {exc}") from exc

        payload = response.json()
        embeddings = payload.get("embeddings")
        if not isinstance(embeddings, list) or len(embeddings) != len(texts):
            raise OllamaError(
                "Ollama devolvió un número inesperado de embeddings "
                f"({len(embeddings) if isinstance(embeddings, list) else '?'} "
                f"para {len(texts)} textos)."
            )

        for vector in embeddings:
            if not isinstance(vector, list) or len(vector) != self.embedding_dim:
                size = len(vector) if isinstance(vector, list) else "?"
                raise OllamaError(
                    f"Dimensión de embedding inesperada: {size} "
                    f"(esperada {self.embedding_dim}). "
                    "Revisa AI_EMBEDDING_MODEL y AI_EMBEDDING_DIM."
                )
        return embeddings

    async def chat(
        self,
        messages: list[dict[str, str]],
        response_schema: dict[str, Any],
    ) -> str:
        payload = {
            "model": self.chat_model,
            "messages": messages,
            "stream": False,
            "think": False,
            "format": response_schema,
            "options": {
                "temperature": self.temperature,
                "num_predict": self.max_tokens,
                "num_ctx": self.context_length,
            },
        }
        try:
            response = await self._client.post("/api/chat", json=payload)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise OllamaError(f"Ollama /api/chat falló: {exc}") from exc

        body = response.json()
        content = body.get("message", {}).get("content", "")
        if not isinstance(content, str) or not content.strip():
            raise OllamaError("Ollama devolvió una respuesta vacía.")
        return content

    async def ping(self) -> bool:
        try:
            response = await self._client.get("/api/tags", timeout=5)
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def list_models(self) -> list[str]:
        try:
            response = await self._client.get("/api/tags", timeout=5)
            response.raise_for_status()
        except httpx.HTTPError:
            return []
        models = response.json().get("models", [])
        return [
            str(model.get("name", ""))
            for model in models
            if isinstance(model, dict) and model.get("name")
        ]
