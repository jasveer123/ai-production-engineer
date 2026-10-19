from types import SimpleNamespace
from typing import Any

import pytest
from google.genai import types
from pydantic import SecretStr

from ai_worker.config import Settings
from ai_worker.llm.gateway import (
    AnthropicProvider,
    ModelError,
    ModelNotConfigured,
    ModelRefused,
    ModelTruncated,
    ModelUnavailable,
    NoProvider,
    get_provider,
)
from ai_worker.llm.gemini import GeminiProvider, map_error
from ai_worker.report import OUTPUT_SCHEMA


def settings(**over: Any) -> Settings:
    base: dict[str, Any] = {
        "anthropic_api_key": None,
        "gemini_api_key": None,
        "ai_provider": "auto",
    }
    base.update(over)
    return Settings(_env_file=None, **base)


@pytest.mark.parametrize(
    ("over", "expected"),
    [
        ({}, NoProvider),
        ({"gemini_api_key": SecretStr("g")}, GeminiProvider),
        ({"anthropic_api_key": SecretStr("a")}, AnthropicProvider),
        (
            {"anthropic_api_key": SecretStr("a"), "gemini_api_key": SecretStr("g")},
            AnthropicProvider,
        ),
        (
            {
                "anthropic_api_key": SecretStr("a"),
                "gemini_api_key": SecretStr("g"),
                "ai_provider": "gemini",
            },
            GeminiProvider,
        ),
        ({"anthropic_api_key": SecretStr("a"), "ai_provider": "gemini"}, NoProvider),
        ({"gemini_api_key": SecretStr("  ")}, NoProvider),
    ],
)
def test_provider_selection(over: dict[str, Any], expected: type) -> None:
    assert isinstance(get_provider(settings(**over)), expected)


class StatusError(Exception):
    def __init__(self, status: int, msg: str = "boom") -> None:
        super().__init__(msg)
        self.status_code = status


@pytest.mark.parametrize(
    ("err", "expected", "retryable"),
    [
        (StatusError(429, "Your project has exceeded a quota"), ModelUnavailable, True),
        (StatusError(503, "currently experiencing high demand"), ModelUnavailable, True),
        (StatusError(401), ModelNotConfigured, False),
        (StatusError(400, "bad schema"), ModelError, False),
    ],
)
def test_error_mapping(err: Exception, expected: type, retryable: bool) -> None:
    mapped = map_error(err)
    assert type(mapped) is expected
    assert mapped.retryable is retryable


class FakeModels:
    """Returns `result` for every model, or per-model results from a dict."""

    def __init__(self, result: Any) -> None:
        self.result = result
        self.kwargs: dict[str, Any] = {}
        self.tried: list[str] = []

    async def generate_content(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        self.tried.append(kwargs["model"])
        out = self.result.get(kwargs["model"]) if isinstance(self.result, dict) else self.result
        if isinstance(out, Exception):
            raise out
        return out


def provider_with(result: Any) -> tuple[GeminiProvider, FakeModels]:
    p = GeminiProvider(settings(gemini_api_key=SecretStr("g"), gemini_model="gemini-3.5-flash"))
    fake = FakeModels(result)
    p.client = SimpleNamespace(aio=SimpleNamespace(models=fake))  # type: ignore[assignment]
    return p, fake


def response(text: str = "{}", finish: types.FinishReason = types.FinishReason.STOP) -> Any:
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(role="model", parts=[types.Part(text=text)]),
                finish_reason=finish,
            )
        ],
        usage_metadata=types.GenerateContentResponseUsageMetadata(
            prompt_token_count=100, candidates_token_count=20, thoughts_token_count=30
        ),
        model_version="gemini-3.5-flash",
    )


async def test_sends_schema_and_system_prompt() -> None:
    p, fake = provider_with(response('{"observations":[],"hypotheses":[],"data_gaps":[]}'))
    call = await p.structured(system="SYS", user="USER", schema=OUTPUT_SCHEMA, purpose="t")
    cfg = fake.kwargs["config"]
    assert cfg.system_instruction == "SYS"
    assert cfg.response_json_schema is OUTPUT_SCHEMA
    assert cfg.response_mime_type == "application/json"
    assert fake.kwargs["contents"] == "USER"
    assert (call.input_tokens, call.output_tokens) == (100, 50)  # thinking counted as output
    assert call.text.startswith('{"observations"')


async def test_quota_errors_are_retryable() -> None:
    p, _ = provider_with(StatusError(429, "Your project has exceeded a quota"))
    with pytest.raises(ModelUnavailable):
        await p.structured(system="s", user="u", schema=OUTPUT_SCHEMA, purpose="t")


async def test_safety_block_is_a_refusal() -> None:
    p, _ = provider_with(response("", finish=types.FinishReason.SAFETY))
    with pytest.raises(ModelRefused):
        await p.structured(system="s", user="u", schema=OUTPUT_SCHEMA, purpose="t")


async def test_truncated_output_is_retryable() -> None:
    p, _ = provider_with(response('{"obs', finish=types.FinishReason.MAX_TOKENS))
    with pytest.raises(ModelTruncated):
        await p.structured(system="s", user="u", schema=OUTPUT_SCHEMA, purpose="t")


async def test_falls_back_to_the_next_model_when_one_is_overloaded() -> None:
    p, fake = provider_with(
        {
            "gemini-3.5-flash": StatusError(503, "high demand"),
            "gemini-3.8-flash": StatusError(429, "exceeded a quota"),
            "gemini-3.7-flash": response('{"observations":[],"hypotheses":[],"data_gaps":[]}'),
        }
    )
    call = await p.structured(system="s", user="u", schema=OUTPUT_SCHEMA, purpose="t")
    assert fake.tried == ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"]
    assert call.text.startswith("{")


async def test_does_not_fall_back_on_a_bad_request() -> None:
    p, fake = provider_with(StatusError(400, "bad schema"))
    with pytest.raises(ModelError):
        await p.structured(system="s", user="u", schema=OUTPUT_SCHEMA, purpose="t")
    assert fake.tried == ["gemini-3.5-flash"]


def test_timeouts_are_retryable() -> None:
    assert type(map_error(TimeoutError("read timed out"))) is ModelUnavailable
    assert map_error(Exception("ReadTimeout: timed out")).retryable is True
