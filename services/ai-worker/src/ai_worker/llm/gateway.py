"""Model gateway (ADR-011/016). Every model call in the worker goes through `ModelProvider`.

It enforces a per-call timeout and an input budget, records tokens/cost/latency, traces the call,
and turns refusals and truncation into typed errors instead of half-read output.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any, Protocol

import anthropic
from opentelemetry import trace
from pydantic import SecretStr

from ai_worker.config import Settings

tracer = trace.get_tracer("ai_worker.llm")
log = logging.getLogger("ai_worker")

# USD per million tokens: (input, output, prompt-size threshold, input above it, output above it).
# Unknown models are recorded with cost 0. Haiku 5.5 charges more once a prompt passes 100K tokens.
PRICING: dict[str, tuple[float, float, int | None, float, float]] = {
    "claude-opus-5-5": (4.0, 20.0, None, 4.0, 20.0),
    "claude-opus-5": (5.0, 25.0, None, 5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0, None, 5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0, None, 2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50, 100_000, 0.50, 2.50),
    "claude-fable-5-1": (10.0, 50.0, None, 10.0, 50.0),
}
CACHE_READ_FACTOR = 0.1  # cache hits cost a tenth of the input price
CACHE_WRITE_FACTOR = 1.25  # writing a 5-minute cache entry costs a quarter more

# Models that accept the server-side refusal fallback. Haiku 5.5 does not, and sending the
# setting to it is rejected, so it is only added for the models listed here.
FALLBACK_MODELS = frozenset(
    {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
)

# Purposes that write code or tests (see fixing.py); everything else reads evidence.
FIX_PURPOSES = frozenset({"TestOut", "PatchOut"})


class ModelError(Exception):
    """Base for gateway errors. `retryable` tells the caller whether another call may help."""

    retryable = False
    reason = "model_error"


class ModelNotConfigured(ModelError):
    reason = "no_model_configured"


class ModelRefused(ModelError):
    reason = "model_refused"


class ModelBilling(ModelError):
    """The provider account cannot be charged (empty balance, spend limit). Retrying cannot help."""

    reason = "ai_billing_issue"


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
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


def cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> float:
    """What one call cost. `input_tokens` excludes cached tokens, as the API reports it."""
    entry = PRICING.get(model)
    if entry is None:
        return 0.0
    price_in, price_out, threshold, long_in, long_out = entry
    prompt = input_tokens + cache_read_tokens + cache_write_tokens
    if threshold is not None and prompt > threshold:
        price_in, price_out = long_in, long_out
    total = (
        input_tokens * price_in
        + cache_read_tokens * price_in * CACHE_READ_FACTOR
        + cache_write_tokens * price_in * CACHE_WRITE_FACTOR
        + output_tokens * price_out
    )
    return round(total / 1_000_000, 6)


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


def route(settings: Settings, purpose: str) -> tuple[str, str]:
    """Which model and effort a call uses: investigations read evidence, fixes write code."""
    if purpose in FIX_PURPOSES:
        return (
            settings.ai_fix_model or settings.ai_model,
            settings.ai_fix_effort or settings.ai_effort,
        )
    return settings.ai_model, settings.ai_effort


def build_request(
    settings: Settings, *, system: str, user: str, schema: dict[str, Any], purpose: str
) -> dict[str, Any]:
    """The exact Messages API request for one call. Pure, so tests can check it without a network.

    Choices that matter for cost and correctness:
    - The system prompt is the one block shared by every incident, so it carries the cache
      breakpoint; retries and bursts then pay a tenth of its input price.
    - No temperature or top_p: the current models reject non-default sampling values.
    - Thinking is left on its default (adaptive); `effort` is the cost control.
    - The server-side refusal fallback is sent only to models that accept it.
    """
    model, effort = route(settings, purpose)
    request: dict[str, Any] = {
        "model": model,
        "max_tokens": settings.ai_max_tokens,
        "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    }
    if model in FALLBACK_MODELS:
        request["betas"] = ["server-side-fallback-2026-07-01"]
        request["fallbacks"] = "default"
    return request


def _billing_problem(message: str) -> bool:
    m = message.lower()
    return "credit balance" in m or "billing" in m or "spend limit" in m or "usage limit" in m


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

        request = build_request(s, system=system, user=user, schema=schema, purpose=purpose)
        with tracer.start_as_current_span("llm.structured") as span:
            span.set_attributes(
                {
                    "llm.provider": self.name,
                    "llm.model": request["model"],
                    "llm.effort": request["output_config"]["effort"],
                    "llm.purpose": purpose,
                }
            )
            started = time.monotonic()
            try:
                response = await self.client.beta.messages.create(**request)
            except anthropic.AuthenticationError as e:
                raise ModelNotConfigured(f"Model provider rejected the API key: {e.message}") from e
            except anthropic.BadRequestError as e:
                if _billing_problem(e.message):
                    raise ModelBilling(
                        f"Model provider cannot bill this account: {e.message}"
                    ) from e
                raise ModelError(f"Model request rejected: {e.message}") from e
            except anthropic.PermissionDeniedError as e:
                raise ModelNotConfigured(f"Model provider denied access: {e.message}") from e
            except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
                raise ModelUnavailable(str(e)) from e
            except anthropic.APIStatusError as e:
                if e.status_code >= 500:
                    raise ModelUnavailable(f"Model provider error {e.status_code}") from e
                raise ModelError(f"Model API error {e.status_code}: {e.message}") from e

            latency_ms = int((time.monotonic() - started) * 1000)
            usage = response.usage
            cache_read = usage.cache_read_input_tokens or 0
            cache_write = usage.cache_creation_input_tokens or 0
            served_by = response.model
            call_cost = cost_usd(
                served_by, usage.input_tokens, usage.output_tokens, cache_read, cache_write
            )
            span.set_attributes(
                {
                    "llm.served_by": served_by,
                    "llm.input_tokens": usage.input_tokens,
                    "llm.output_tokens": usage.output_tokens,
                    "llm.cache_read_tokens": cache_read,
                    "llm.cache_write_tokens": cache_write,
                    "llm.cost_usd": call_cost,
                    "llm.stop_reason": str(response.stop_reason),
                }
            )
            log.info(
                "llm %s %s: in=%d (cache %d read, %d written) out=%d $%.5f %dms stop=%s",
                purpose,
                served_by,
                usage.input_tokens,
                cache_read,
                cache_write,
                usage.output_tokens,
                call_cost,
                latency_ms,
                response.stop_reason,
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
                cache_read_tokens=cache_read,
                cache_write_tokens=cache_write,
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
    if choice == "openai" and _has(settings.openai_api_key):
        from ai_worker.llm.openai_provider import OpenAIProvider

        return OpenAIProvider(settings)
    return NoProvider()
