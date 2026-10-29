"""Evaluation cases (frozen evidence bundles) and the machine-readable answer key."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from ai_worker.contracts import EvidenceBundle

EVAL_DIR = Path(__file__).resolve().parents[5] / "tests" / "evaluation"


class Scenario(BaseModel):
    title: str
    files: list[str]
    symbols: list[str]
    keywords: list[str]


class Expect(BaseModel):
    """`diagnose`: the scenario's cause must be hypothesis 1. `abstain`: no confident cause."""

    mode: Literal["diagnose", "abstain"]
    forbidden: list[str] = Field(default_factory=list)
    forbidden_top1: list[str] = Field(default_factory=list)
    max_confidence: Literal["low", "medium", "high"] | None = None
    forbidden_anywhere: list[str] = Field(default_factory=list)


class Case(BaseModel):
    id: str
    scenario: str | None
    description: str
    expect: Expect
    bundle: EvidenceBundle


def load_answer_key(path: Path) -> dict[str, Scenario]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: Scenario.model_validate(v) for k, v in raw.items() if not k.startswith("$")}


def load_cases(
    directory: Path, key: dict[str, Scenario], only: list[str] | None = None
) -> list[Case]:
    cases = [
        Case.model_validate_json(p.read_text(encoding="utf-8"))
        for p in sorted(directory.glob("*.json"))
    ]
    if only:
        unknown = set(only) - {c.id for c in cases}
        if unknown:
            raise ValueError(f"Unknown case(s): {', '.join(sorted(unknown))}")
        cases = [c for c in cases if c.id in only]
    for c in cases:
        if c.expect.mode == "diagnose" and (c.scenario is None or c.scenario not in key):
            raise ValueError(
                f"Case {c.id} expects a diagnosis but scenario {c.scenario} has no key"
            )
    return cases
