import pytest

from ai_worker.config import Settings
from ai_worker.llm.gateway import FALLBACK_MODELS, build_request, cost_usd, route

SCHEMA = {"type": "object"}


def settings(**over: object) -> Settings:
    return Settings(_env_file=None, **{"anthropic_api_key": None, "gemini_api_key": None, **over})  # type: ignore[arg-type]


def request(purpose: str = "investigate", **over: object) -> dict:
    return build_request(settings(**over), system="S", user="U", schema=SCHEMA, purpose=purpose)


def test_haiku_request_has_cache_breakpoint_effort_schema_and_no_fallback() -> None:
    r = request()
    assert r["model"] == "claude-haiku-5-5"
    assert r["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert r["output_config"] == {
        "effort": "medium",
        "format": {"type": "json_schema", "schema": SCHEMA},
    }
    assert "fallbacks" not in r and "betas" not in r
    assert "temperature" not in r and "top_p" not in r


@pytest.mark.parametrize("model", sorted(FALLBACK_MODELS))
def test_models_that_support_fallback_get_it(model: str) -> None:
    r = request(ai_model=model)
    assert r["fallbacks"] == "default" and r["betas"]


def test_fix_calls_can_use_a_stronger_model_and_effort() -> None:
    over = {"ai_fix_model": "claude-sonnet-5-5", "ai_fix_effort": "high"}
    assert route(settings(**over), "PatchOut") == ("claude-sonnet-5-5", "high")
    assert route(settings(**over), "TestOut") == ("claude-sonnet-5-5", "high")
    assert route(settings(**over), "investigate") == ("claude-haiku-5-5", "medium")
    assert route(settings(), "PatchOut") == ("claude-haiku-5-5", "medium")


def test_cost_counts_cache_reads_and_writes() -> None:
    plain = cost_usd("claude-haiku-5-5", 10_000, 1_000)
    assert plain == pytest.approx(0.0015)  # 10K x $0.10/M + 1K x $0.50/M
    cached = cost_usd("claude-haiku-5-5", 0, 1_000, cache_read_tokens=10_000)
    assert cached == pytest.approx(0.0006)  # reads cost a tenth of the input price
    write = cost_usd("claude-haiku-5-5", 0, 0, cache_write_tokens=10_000)
    assert write == pytest.approx(0.00125)


def test_cost_uses_the_higher_tier_for_prompts_over_100k_tokens() -> None:
    assert (
        cost_usd("claude-haiku-5-5", 100_001, 0) == 0.050001
    )  # 100,001 tokens at $0.50/M, rounded to 6 places


def test_unknown_models_cost_nothing_to_record() -> None:
    assert cost_usd("some-new-model", 1_000_000, 1_000_000) == 0.0
