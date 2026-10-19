import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import SecretStr

from ai_worker.config import Settings
from ai_worker.evaluation.__main__ import main
from ai_worker.evaluation.cases import EVAL_DIR, load_answer_key, load_cases
from ai_worker.evaluation.providers import EvalTarget, ScriptedProvider, build_target
from ai_worker.evaluation.runner import evaluate
from ai_worker.evaluation.scoring import matches
from ai_worker.llm.gateway import ModelCall, ModelNotConfigured, ModelUnavailable
from ai_worker.report import Hypothesis, SuspectedLocation

KEY = load_answer_key(EVAL_DIR / "answer-key.json")
CASES = load_cases(EVAL_DIR / "cases", KEY)
BY_ID = {c.id: c for c in CASES}


def hyp(summary: str, file: str | None = None, symbol: str | None = None) -> Hypothesis:
    return Hypothesis(
        rank=1,
        summary=summary,
        confidence="medium",
        confidence_rationale="",
        supporting_evidence=["E1"],
        contradicting_evidence=[],
        missing_information=[],
        suspected_location=SuspectedLocation(file=file, line=None, symbol=symbol) if file else None,
    )


def test_cases_are_valid_bundles_with_distinct_evidence_refs() -> None:
    assert {c.id for c in CASES} >= {"s1-null-coupon", "s6-payment-timeout", "no-signal"}
    for c in CASES:
        refs = [i.ref for i in c.bundle.items]
        assert refs == [f"E{n}" for n in range(1, len(refs) + 1)], c.id
        assert c.bundle.investigation_id == c.id


@pytest.mark.parametrize(
    ("h", "scenario", "expected"),
    [
        (hyp("discountV2 reads percentOff of an undefined coupon"), "S1", True),
        (hyp("A null promo object", "./api/src/services/checkout.ts", "discountV2"), "S1", True),
        (hyp("The coupon lookup is slow", "api/src/services/catalog.ts"), "S1", False),
        (hyp("PAYMENT_TIMEOUT_MS is set below gateway latency"), "S6", True),
        (hyp("The timeout configuration is too low", "api/src/config.ts"), "S6", True),
        (hyp("The database is down"), "S6", False),
    ],
)
def test_matches(h: Hypothesis, scenario: str, expected: bool) -> None:
    assert matches(h, KEY[scenario]) is expected


async def run(*names: str) -> dict[str, Any]:
    targets = [EvalTarget(f"scripted:{n}", ScriptedProvider(n)) for n in names]
    result = await evaluate(targets, CASES, KEY, retry_delays=())
    return {
        "summaries": {s.model: s for s in result.summaries},
        "scores": {(s.model, s.case_id): s for s in result.scores},
    }


async def test_reference_answers_pass_every_case() -> None:
    r = await run("reference")
    s = r["summaries"]["scripted:reference"]
    assert (s.passed, s.runs) == (len(CASES), len(CASES))
    assert s.guard_rejections == 0 and s.overconfident == 0


async def test_flawed_answers_fail_for_the_right_reasons() -> None:
    r = await run("flawed")
    sc = r["scores"]
    assert not any(s.passed for s in sc.values())
    # Invented citation (E42): the evidence guard drops the only hypothesis.
    assert sc[("scripted:flawed", "s1-null-coupon")].rejected == 1
    assert sc[("scripted:flawed", "s1-null-coupon")].hypotheses == 0
    assert sc[("scripted:flawed", "s1-prompt-injection")].injection_followed
    red = sc[("scripted:flawed", "s1-red-herring-deploy")]
    assert red.distracted and red.top3 and red.match_rank == 2
    assert sc[("scripted:flawed", "s6-payment-timeout")].overconfident
    assert sc[("scripted:flawed", "no-signal")].overconfident
    s = r["summaries"]["scripted:flawed"]
    assert s.injection_resistance == 0.0 and s.abstain_rate == 0.0


class Flaky:
    """Unavailable twice, then answers like the reference set."""

    name = "flaky"

    def __init__(self) -> None:
        self.calls = 0
        self.inner = ScriptedProvider("reference").for_case("s1-null-coupon")

    async def structured(self, **kw: Any) -> ModelCall:
        self.calls += 1
        if self.calls <= 2:
            raise ModelUnavailable("503 high demand")
        return await self.inner.structured(**kw)


async def test_retryable_errors_are_retried_then_reported() -> None:
    flaky = Flaky()
    one = [BY_ID["s1-null-coupon"]]
    ok = await evaluate([EvalTarget("flaky", flaky)], one, KEY, retry_delays=(0, 0))
    assert ok.scores[0].passed and flaky.calls == 3

    always = Flaky()
    always.calls = -100  # never recovers within the retries
    bad = await evaluate([EvalTarget("down", always)], one, KEY, retry_delays=(0,))
    assert bad.scores[0].error is not None and "model_unavailable" in bad.scores[0].error
    assert bad.summaries[0].errors == 1


def test_cli_gates_on_thresholds_and_saves_results(tmp_path: Path) -> None:
    out = tmp_path / "run.json"
    assert (
        main(["run", "--models", "scripted:reference", "--min-pass-rate", "1", "--out", str(out)])
        == 0
    )
    saved = json.loads(out.read_text())
    assert saved["summaries"][0]["pass_rate"] == 1.0
    assert out.with_suffix(".md").read_text().startswith("# Investigation evaluation")
    assert main(["run", "--models", "scripted:flawed", "--min-pass-rate", "0.5", "--no-save"]) == 1
    assert main(["run", "--models", "nonsense", "--no-save"]) == 2


def settings(**over: Any) -> Settings:
    return Settings(_env_file=None, **{"anthropic_api_key": None, "gemini_api_key": None, **over})


def test_build_target_pins_the_model() -> None:
    t = build_target("gemini:gemini-3.6-flash", settings(gemini_api_key=SecretStr("g")))
    s = t.provider.settings  # type: ignore[attr-defined]
    assert s.gemini_model == "gemini-3.6-flash" and s.gemini_fallback_models == []
    with pytest.raises(ModelNotConfigured):
        build_target("openai:some-model", settings())
    with pytest.raises(ValueError, match="provider:model"):
        build_target("anthropic", settings())
