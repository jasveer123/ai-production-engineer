from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated worker config. Startup fails fast if a value is invalid."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    port: int = 8000
    otel_exporter_otlp_endpoint: str = "http://localhost:4318"
    otel_enabled: bool = True

    # Temporal (ADR-015): this worker serves the `ai` task queue.
    temporal_address: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "ai"

    # Object storage for evidence bundles and reports (RustFS locally, S3 in deployment).
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "ape-minio"
    s3_secret_key: SecretStr = SecretStr("ape-minio-secret")
    s3_bucket: str = "ape-artifacts"

    # Model gateway (ADR-016). No key -> investigations end as needs_review, never invented.
    # "auto" picks Anthropic when its key is set, else Gemini when its key is set.
    ai_provider: Literal["auto", "anthropic", "gemini"] = "auto"
    anthropic_api_key: SecretStr | None = None
    ai_model: str = "claude-opus-5-5"
    ai_effort: str = "high"
    ai_max_tokens: int = 16000
    ai_timeout_seconds: float = 240.0
    # Refuse bundles larger than this (rough chars/4 token estimate) instead of truncating silently.
    ai_max_input_tokens: int = 150_000

    # Google Gemini (free tier works; capacity errors are retried by Temporal).
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash"
    # Tried in order when the model above is overloaded (503) or over its free quota (429).
    gemini_timeout_seconds: float = 90.0
    gemini_fallback_models: list[str] = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]

    # Kept for the Phase 9 model comparison; no OpenAI adapter yet.
    openai_api_key: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
