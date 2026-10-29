"""Google Gemini adapter for the model gateway (generate_content with a JSON schema).

The newer Interactions API has a much smaller free-tier quota, so this uses generate_content.
"""

import time
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
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


def _status_of(err: Exception) -> int | None:
    for attr in ("code", "status_code", "status"):
        value = getattr(err, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(err, "response", None)
    status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def map_error(err: Exception) -> ModelError:
    """Turns SDK errors into gateway errors: capacity/rate limits are retryable."""
    status = _status_of(err)
    text = str(err)[:300]
    if status in (401, 403):
        return ModelNotConfigured(f"Gemini rejected the API key: {text}")
    if (
        isinstance(err, TimeoutError)
        or "timeout" in type(err).__name__.lower()
        or "timed out" in text.lower()
    ):
        return ModelUnavailable(f"Gemini request timed out: {text or type(err).__name__}")
    if (
        status in (408, 429, 500, 502, 503, 504)
        or "high demand" in text
        or "RESOURCE_EXHAUSTED" in text
    ):
        return ModelUnavailable(f"Gemini temporarily unavailable ({status}): {text}")
    if status == 400:
        return ModelError(f"Gemini request rejected: {text}")
    if isinstance(err, genai_errors.ServerError):
        return ModelUnavailable(f"Gemini server error: {text}")
    return ModelError(f"Gemini error ({status}): {text}")


class GeminiProvider:
    name = "gemini"

    def __init__(self, settings: Settings) -> None:
        if settings.gemini_api_key is None:
            raise ModelNotConfigured("GEMINI_API_KEY is not set")
        self.settings = settings
        self.client = genai.Client(api_key=settings.gemini_api_key.get_secret_value())

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        s = self.settings
        if estimate_tokens(system, user) > s.ai_max_input_tokens:
            raise InputTooLarge(f"Evidence exceeds the {s.ai_max_input_tokens}-token input budget")
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            max_output_tokens=s.ai_max_tokens,
            http_options=types.HttpOptions(timeout=int(s.gemini_timeout_seconds * 1000)),
        )
        with tracer.start_as_current_span("llm.structured") as span:
            span.set_attributes(
                {"llm.provider": self.name, "llm.model": s.gemini_model, "llm.purpose": purpose}
            )
            started = time.monotonic()
            r = None
            last: ModelError | None = None
            for model in dict.fromkeys([s.gemini_model, *s.gemini_fallback_models]):
                try:
                    r = await self.client.aio.models.generate_content(
                        model=model, contents=user, config=config
                    )
                    break
                except Exception as e:
                    last = map_error(e)
                    if not last.retryable:
                        raise last from e
                    span.add_event("llm.fallback", {"model": model, "error": str(last)[:200]})
            if r is None:
                raise last or ModelUnavailable("No Gemini model available")
            latency_ms = int((time.monotonic() - started) * 1000)

            meta = r.usage_metadata
            input_tokens = (meta.prompt_token_count or 0) if meta else 0
            output_tokens = (
                ((meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0))
                if meta
                else 0
            )
            served_by = r.model_version or s.gemini_model
            call_cost = cost_usd(served_by, input_tokens, output_tokens)
            finish = str(r.candidates[0].finish_reason) if r.candidates else ""
            span.set_attributes(
                {
                    "llm.served_by": served_by,
                    "llm.input_tokens": input_tokens,
                    "llm.output_tokens": output_tokens,
                    "llm.cost_usd": call_cost,
                    "llm.finish_reason": finish,
                }
            )
            blocked = r.prompt_feedback.block_reason if r.prompt_feedback else None
            if blocked or any(k in finish for k in ("SAFETY", "PROHIBITED", "BLOCKLIST", "SPII")):
                raise ModelRefused(f"Gemini blocked the request ({blocked or finish})")
            if "MAX_TOKENS" in finish:
                raise ModelTruncated("Gemini output hit max_output_tokens")
            return ModelCall(
                text=r.text or "",
                model=served_by,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=call_cost,
                latency_ms=latency_ms,
            )
