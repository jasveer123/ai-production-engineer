"""Runs every case through the real investigation pipeline (prompt, schema, evidence guard)."""

import asyncio
import logging
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

from ai_worker.evaluation.cases import Case, Scenario
from ai_worker.evaluation.providers import EvalTarget
from ai_worker.evaluation.scoring import CaseScore, ModelSummary, score, summarize
from ai_worker.investigate import run_investigation
from ai_worker.llm.gateway import ModelError
from ai_worker.report import StoredReport

log = logging.getLogger("ai_worker.evaluation")
RETRY_DELAYS = (5.0, 15.0)


@dataclass
class EvalRun:
    started_at: str
    prompt_version: str
    repeat: int
    cases: list[str]
    summaries: list[ModelSummary]
    scores: list[CaseScore]

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


async def _investigate(
    target: EvalTarget, case: Case, prompt_version: str, delays: tuple[float, ...]
) -> tuple[StoredReport | None, str | None]:
    """Same call the Temporal activity makes. Retryable errors get a couple of retries here,
    since there is no Temporal to retry them."""
    for attempt in range(len(delays) + 1):
        try:
            report = await run_investigation(case.bundle, target.for_case(case.id), prompt_version)
            return report, None
        except ModelError as e:
            if not e.retryable or attempt == len(delays):
                return None, f"{e.reason}: {e}"
            log.warning("%s on %s: %s; retrying", target.label, case.id, e)
            await asyncio.sleep(delays[attempt])
    raise AssertionError("unreachable")


async def evaluate(
    targets: list[EvalTarget],
    cases: list[Case],
    key: dict[str, Scenario],
    *,
    prompt_version: str = "investigate_v1",
    repeat: int = 1,
    retry_delays: tuple[float, ...] = RETRY_DELAYS,
) -> EvalRun:
    started = datetime.now(UTC).isoformat(timespec="seconds")
    by_id = {c.id: c for c in cases}
    scores: list[CaseScore] = []
    summaries: list[ModelSummary] = []
    for target in targets:
        mine: list[CaseScore] = []
        for case in cases:
            for _ in range(repeat):
                report, error = await _investigate(target, case, prompt_version, retry_delays)
                s = score(case, target.label, report, error, key)
                mine.append(s)
                log.info("%s %s: %s", target.label, case.id, "pass" if s.passed else "FAIL")
        scores += mine
        summaries.append(summarize(target.label, mine, by_id))
    return EvalRun(
        started_at=started,
        prompt_version=prompt_version,
        repeat=repeat,
        cases=[c.id for c in cases],
        summaries=summaries,
        scores=scores,
    )
