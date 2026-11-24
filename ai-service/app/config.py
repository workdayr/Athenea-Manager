from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración del microservicio, leída de variables de entorno o .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str

    ollama_base_url: str = "http://127.0.0.1:11434"
    ai_chat_model: str = "qwen3:8b"
    ai_embedding_model: str = "qwen3-embedding:0.6b"
    ai_embedding_dim: int = 1024

    ai_top_k: int = 4
    ai_min_similarity: float = 0.35
    ai_max_tokens: int = 400
    ai_context_length: int = 8192
    ai_temperature: float = 0.1
    ai_request_timeout_s: float = 90.0

    ai_chunk_size: int = 1000
    ai_chunk_overlap: int = 150
    ai_embed_batch_size: int = 16

    # Carpeta real (host) donde docker-compose monta los uploads.
    # Las rutas de `ProjectDocument.file_url` son del contenedor
    # (/app/uploads/...), así que se reescriben con este prefijo.
    ai_upload_dir: str = "/app/uploads"
    # Cada cuántos segundos se buscan PDFs nuevos sin indexar. 0 desactiva.
    ai_sync_interval_s: int = 120

    ai_service_host: str = "0.0.0.0"
    ai_service_port: int = 8010
    ai_service_token: str
    # Consultas por usuario y minuto. 0 desactiva el límite.
    ai_rate_limit_per_minute: int = 12

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
