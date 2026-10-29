from types import SimpleNamespace
from typing import Any

import httpx2 as httpx
import openai
import pytest
from pydantic import SecretStr

from ai_worker.config import Settings
from ai_worker.llm.gateway import (
    ModelError,
    ModelNotConfigured,
    ModelRefused,
    ModelTruncated,
    ModelUnavailable,
    NoProvider,
    get_provider,
)
from ai_worker.llm.openai_provider import OpenAIProvider, map_error
from ai_worker.report import OUTPUT_SCHEMA


def settings(**over: Any) -> Settings:
    base: dict[str, Any] = {
        "anthropic_api_key": None,
        "gemini_api_key": None,
        "openai_api_key": SecretStr("sk-test"),
        "openai_model": "some-model",
    }
    base.update(over)
    return Settings(_env_file=None, **base)


def test_openai_is_never_chosen_by_auto() -> None:
    assert isinstance(get_provider(settings(ai_provider="auto")), NoProvider)
    assert isinstance(get_provider(settings(ai_provider="openai")), OpenAIProvider)
    with pytest.raises(ModelNotConfigured, match="OPENAI_MODEL"):
        OpenAIProvider(settings(openai_model=None))


def response(**over: Any) -> SimpleNamespace:
    base: dict[str, Any] = {
        "model": "some-model-2026",
        "status": "completed",
        "incomplete_details": None,
        "usage": SimpleNamespace(input_tokens=1200, output_tokens=300),
        "output": [SimpleNamespace(type="message", content=[SimpleNamespace(type="output_text")])],
        "output_text": '{"observations": [], "hypotheses": [], "data_gaps": []}',
    }
    base.update(over)
    return SimpleNamespace(**base)


class FakeResponses:
    def __init__(self, result: Any) -> None:
        self.result = result
        self.kwargs: dict[str, Any] = {}

    async def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def provider(result: Any) -> tuple[OpenAIProvider, FakeResponses]:
    p = OpenAIProvider(settings())
    fake = FakeResponses(result)
    p.client = SimpleNamespace(responses=fake)  # type: ignore[assignment]
    return p, fake


async def call(p: OpenAIProvider) -> Any:
    return await p.structured(system="sys", user="usr", schema=OUTPUT_SCHEMA, purpose="t")


async def test_sends_a_strict_schema_and_records_usage() -> None:
    p, fake = provider(response())
    out = await call(p)
    assert out.model == "some-model-2026"
    assert (out.input_tokens, out.output_tokens) == (1200, 300)
    fmt = fake.kwargs["text"]["format"]
    assert fmt["type"] == "json_schema" and fmt["strict"] is True
    assert fmt["schema"] is OUTPUT_SCHEMA
    assert fake.kwargs["instructions"] == "sys" and fake.kwargs["input"] == "usr"


async def test_refusal_and_truncation_are_typed_errors() -> None:
    refused = response(
        output=[
            SimpleNamespace(type="message", content=[SimpleNamespace(type="refusal", refusal="no")])
        ]
    )
    with pytest.raises(ModelRefused):
        await call(provider(refused)[0])
    cut = response(
        status="incomplete", incomplete_details=SimpleNamespace(reason="max_output_tokens")
    )
    with pytest.raises(ModelTruncated):
        await call(provider(cut)[0])


def status_error(cls: type[openai.APIStatusError], code: int) -> openai.APIStatusError:
    req = httpx.Request("POST", "https://api.openai.com/v1/responses")
    return cls("boom", response=httpx.Response(code, request=req), body=None)


@pytest.mark.parametrize(
    ("err", "expected", "retryable"),
    [
        (status_error(openai.RateLimitError, 429), ModelUnavailable, True),
        (status_error(openai.InternalServerError, 503), ModelUnavailable, True),
        (status_error(openai.AuthenticationError, 401), ModelNotConfigured, False),
        (status_error(openai.BadRequestError, 400), ModelError, False),
        (
            openai.APITimeoutError(httpx.Request("POST", "https://api.openai.com")),
            ModelUnavailable,
            True,
        ),
    ],
)
def test_error_mapping(err: Exception, expected: type, retryable: bool) -> None:
    mapped = map_error(err)
    assert type(mapped) is expected
    assert mapped.retryable is retryable


async def test_sdk_errors_surface_as_gateway_errors() -> None:
    with pytest.raises(ModelUnavailable):
        await call(provider(status_error(openai.RateLimitError, 429))[0])
