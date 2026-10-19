"""Model gateway (ADR-011/016). Every model call in the worker goes through `ModelProvider`.

It enforces a per-call timeout and an input budget, records tokens/cost/latency, traces the call,
and turns refusals and truncation into typed errors instead of half-read output.
"""

import time
from dataclasses import dataclass
from typing import Any, Protocol

import anthropic
from anthropic.types.beta import BetaMessageParam, BetaOutputConfigParam
from opentelemetry import trace
from pydantic import SecretStr

from ai_worker.config import Settings

tracer = trace.get_tracer("ai_worker.llm")

# USD per million tokens (input, output). Unknown models are recorded with cost 0 and flagged.
PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-fable-5-1": (10.0, 50.0),
}


class ModelError(Exception):
    """Base for gateway errors. `retryable` tells the caller whether another call may help."""

    retryable = False
    reason = "model_error"


class ModelNotConfigured(ModelError):
    reason = "no_model_configured"


class ModelRefused(ModelError):
    reason = "model_refused"


class ModelTruncated(ModelError):
    retryable = True
    reason = "output_truncated"


class InputTooLarge(ModelError):
    reason = "evidence_too_large"


class ModelUnavailable(ModelError):
    retryable = True
    reason = "model_unavailable"


@dataclass
class ModelCall:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICING.get(model, (0.0, 0.0))
    return round((input_tokens * price_in + output_tokens * price_out) / 1_000_000, 6)


def estimate_tokens(*texts: str) -> int:
    """Rough budget check before calling (about 4 characters per token)."""
    return sum(len(t) for t in texts) // 4


class ModelProvider(Protocol):
    name: str

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall: ...


class NoProvider:
    """Used when no API key is configured: fails clearly instead of inventing output."""

    name = "none"

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        raise ModelNotConfigured("No model provider configured (set ANTHROPIC_API_KEY)")


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        if settings.anthropic_api_key is None:
            raise ModelNotConfigured("ANTHROPIC_API_KEY is not set")
        self.settings = settings
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key.get_secret_value(),
            timeout=settings.ai_timeout_seconds,
            max_retries=2,  # SDK retries 429/5xx/connection errors with backoff
        )

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        s = self.settings
        if estimate_tokens(system, user) > s.ai_max_input_tokens:
            raise InputTooLarge(f"Evidence exceeds the {s.ai_max_input_tokens}-token input budget")

        with tracer.start_as_current_span("llm.structured") as span:
            span.set_attributes(
                {"llm.provider": self.name, "llm.model": s.ai_model, "llm.purpose": purpose}
            )
            messages: list[BetaMessageParam] = [{"role": "user", "content": user}]
            output_config: BetaOutputConfigParam = {
                "effort": s.ai_effort,  # type: ignore[typeddict-item]  # validated by the API
                "format": {"type": "json_schema", "schema": schema},
            }
            started = time.monotonic()
            try:
                response = await self.client.beta.messages.create(
                    model=s.ai_model,
                    max_tokens=s.ai_max_tokens,
                    system=system,
                    messages=messages,
                    output_config=output_config,
                    # Server-side refusal fallback, routed by refusal category.
                    betas=["server-side-fallback-2026-07-01"],
                    fallbacks="default",
                )
            except anthropic.AuthenticationError as e:
                raise ModelNotConfigured(f"Model provider rejected the API key: {e.message}") from e
            except anthropic.BadRequestError as e:
                raise ModelError(f"Model request rejected: {e.message}") from e
            except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
                raise ModelUnavailable(str(e)) from e
            except anthropic.APIStatusError as e:
                if e.status_code >= 500:
                    raise ModelUnavailable(f"Model provider error {e.status_code}") from e
                raise ModelError(f"Model API error {e.status_code}: {e.message}") from e

            latency_ms = int((time.monotonic() - started) * 1000)
            usage = response.usage
            served_by = response.model
            call_cost = cost_usd(served_by, usage.input_tokens, usage.output_tokens)
            span.set_attributes(
                {
                    "llm.served_by": served_by,
                    "llm.input_tokens": usage.input_tokens,
                    "llm.output_tokens": usage.output_tokens,
                    "llm.cost_usd": call_cost,
                    "llm.stop_reason": str(response.stop_reason),
                }
            )

            if response.stop_reason == "refusal":
                category = response.stop_details.category if response.stop_details else None
                raise ModelRefused(f"Model declined the request (category: {category})")
            if response.stop_reason == "max_tokens":
                raise ModelTruncated("Model output hit max_tokens")

            text = next((b.text for b in response.content if b.type == "text"), "")
            return ModelCall(
                text=text,
                model=served_by,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cost_usd=call_cost,
                latency_ms=latency_ms,
            )


def _has(secret: SecretStr | None) -> bool:
    return bool(secret and secret.get_secret_value().strip())


def get_provider(settings: Settings) -> ModelProvider:
    choice = settings.ai_provider
    if choice in ("auto", "anthropic") and _has(settings.anthropic_api_key):
        return AnthropicProvider(settings)
    if choice in ("auto", "gemini") and _has(settings.gemini_api_key):
        from ai_worker.llm.gemini import GeminiProvider  # optional dependency path

        return GeminiProvider(settings)
    return NoProvider()
