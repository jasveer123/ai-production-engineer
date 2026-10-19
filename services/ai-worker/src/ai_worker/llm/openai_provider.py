"""OpenAI adapter for the model gateway (Responses API with a strict JSON schema).

Added for the Phase 9 model comparison (ADR-021). Selected only with AI_PROVIDER=openai, never by
"auto", so adding a key does not silently change which model investigates production incidents.
"""

import time
from typing import Any

import openai
from opentelemetry import trace

from ai_worker.config import Settings
from ai_worker.llm.gateway import (
    InputTooLarge,
    ModelCall,
    ModelError,
    ModelNotConfigured,
    ModelRefused,
    ModelTruncated,
    ModelUnavailable,
    cost_usd,
    estimate_tokens,
)

tracer = trace.get_tracer("ai_worker.llm")


def map_error(err: Exception) -> ModelError:
    """SDK errors to gateway errors. Rate limits, timeouts and 5xx are retryable."""
    if isinstance(err, openai.AuthenticationError | openai.PermissionDeniedError):
        return ModelNotConfigured(f"OpenAI rejected the API key: {err.message}")
    if isinstance(err, openai.RateLimitError | openai.APIConnectionError):
        return ModelUnavailable(f"OpenAI temporarily unavailable: {err}"[:300])
    if isinstance(err, openai.BadRequestError):
        return ModelError(f"OpenAI request rejected: {err.message}"[:300])
    if isinstance(err, openai.APIStatusError):
        if err.status_code >= 500:
            return ModelUnavailable(f"OpenAI server error {err.status_code}")
        return ModelError(f"OpenAI API error {err.status_code}: {err.message}"[:300])
    return ModelError(f"OpenAI error: {err}"[:300])


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: Settings) -> None:
        if settings.openai_api_key is None:
            raise ModelNotConfigured("OPENAI_API_KEY is not set")
        if not settings.openai_model:
            raise ModelNotConfigured("OPENAI_MODEL is not set")
        self.settings = settings
        self.model: str = settings.openai_model
        self.client = openai.AsyncOpenAI(
            api_key=settings.openai_api_key.get_secret_value(),
            timeout=settings.ai_timeout_seconds,
            max_retries=2,
        )

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        s = self.settings
        if estimate_tokens(system, user) > s.ai_max_input_tokens:
            raise InputTooLarge(f"Evidence exceeds the {s.ai_max_input_tokens}-token input budget")
        with tracer.start_as_current_span("llm.structured") as span:
            span.set_attributes(
                {"llm.provider": self.name, "llm.model": self.model, "llm.purpose": purpose}
            )
            started = time.monotonic()
            try:
                r = await self.client.responses.create(
                    model=self.model,
                    instructions=system,
                    input=user,
                    max_output_tokens=s.ai_max_tokens,
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "investigation_report",
                            "schema": schema,
                            "strict": True,
                        }
                    },
                )
            except openai.OpenAIError as e:
                raise map_error(e) from e
            latency_ms = int((time.monotonic() - started) * 1000)

            input_tokens = r.usage.input_tokens if r.usage else 0
            output_tokens = r.usage.output_tokens if r.usage else 0
            served_by = r.model or self.model
            call_cost = cost_usd(served_by, input_tokens, output_tokens)
            span.set_attributes(
                {
                    "llm.served_by": served_by,
                    "llm.input_tokens": input_tokens,
                    "llm.output_tokens": output_tokens,
                    "llm.cost_usd": call_cost,
                    "llm.status": str(r.status),
                }
            )

            refusal = next(
                (
                    part.refusal
                    for item in r.output
                    if item.type == "message"
                    for part in item.content
                    if part.type == "refusal"
                ),
                None,
            )
            if refusal is not None:
                raise ModelRefused(f"OpenAI declined the request: {refusal[:200]}")
            reason = r.incomplete_details.reason if r.incomplete_details else None
            if reason == "content_filter":
                raise ModelRefused("OpenAI blocked the output (content_filter)")
            if reason == "max_output_tokens":
                raise ModelTruncated("OpenAI output hit max_output_tokens")
            return ModelCall(
                text=r.output_text,
                model=served_by,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=call_cost,
                latency_ms=latency_ms,
            )
