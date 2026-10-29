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

    temporal_address: str = "localhost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "ai"

    s3_use_aws: bool = False
    s3_region: str = "us-east-1"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "ape-minio"
    s3_secret_key: SecretStr = SecretStr("ape-minio-secret")
    s3_bucket: str = "ape-artifacts"

    ai_provider: Literal["auto", "anthropic", "gemini", "openai"] = "auto"
    anthropic_api_key: SecretStr | None = None
    ai_model: str = "claude-haiku-5-5"
    ai_effort: str = "medium"
    ai_fix_model: str | None = None
    ai_fix_effort: str | None = None
    ai_max_tokens: int = 16000
    ai_timeout_seconds: float = 240.0
    ai_max_input_tokens: int = 100_000

    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash"
    gemini_timeout_seconds: float = 90.0
    gemini_fallback_models: list[str] = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"]

    openai_api_key: SecretStr | None = None
    openai_model: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
