"""Fábrica del cliente de Ollama a partir de la configuración."""

from __future__ import annotations

from .config import Settings
from .ollama import OllamaClient


def build_ollama(settings: Settings) -> OllamaClient:
    return OllamaClient(
        base_url=settings.ollama_base_url,
        chat_model=settings.ai_chat_model,
        embedding_model=settings.ai_embedding_model,
        embedding_dim=settings.ai_embedding_dim,
        timeout_s=settings.ai_request_timeout_s,
        temperature=settings.ai_temperature,
        max_tokens=settings.ai_max_tokens,
        context_length=settings.ai_context_length,
    )
