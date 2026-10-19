"""The investigation report: what the model must return, and what we store after the guard."""

from typing import Any, Literal

from pydantic import BaseModel, Field

Confidence = Literal["high", "medium", "low"]


class Observation(BaseModel):
    statement: str = Field(min_length=1, max_length=1000)
    evidence: list[str]


class SuspectedLocation(BaseModel):
    file: str
    line: int | None
    symbol: str | None


class Hypothesis(BaseModel):
    rank: int = Field(ge=1, le=3)
    summary: str = Field(min_length=1, max_length=1500)
    confidence: Confidence
    confidence_rationale: str
    supporting_evidence: list[str]
    contradicting_evidence: list[str]
    missing_information: list[str]
    suspected_location: SuspectedLocation | None


class ModelReport(BaseModel):
    """Exactly what the model returns (validated against OUTPUT_SCHEMA and again here)."""

    observations: list[Observation]
    hypotheses: list[Hypothesis] = Field(max_length=3)
    data_gaps: list[str]


class Rejected(BaseModel):
    kind: Literal["observation", "hypothesis"]
    text: str
    reason: str


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    calls: int = 0


class StoredReport(BaseModel):
    version: Literal[1] = 1
    investigation_id: str
    prompt_version: str
    model: str | None
    status: Literal["completed", "needs_review"]
    reason: str | None
    observations: list[Observation] = []
    hypotheses: list[Hypothesis] = []
    data_gaps: list[str] = []
    rejected: list[Rejected] = []
    usage: Usage = Usage()


def _str_list() -> dict[str, Any]:
    return {"type": "array", "items": {"type": "string"}}


# Hand-written so every object is closed and every field required (structured-output rules).
OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["observations", "hypotheses", "data_gaps"],
    "properties": {
        "observations": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["statement", "evidence"],
                "properties": {"statement": {"type": "string"}, "evidence": _str_list()},
            },
        },
        "hypotheses": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "rank",
                    "summary",
                    "confidence",
                    "confidence_rationale",
                    "supporting_evidence",
                    "contradicting_evidence",
                    "missing_information",
                    "suspected_location",
                ],
                "properties": {
                    "rank": {"type": "integer", "enum": [1, 2, 3]},
                    "summary": {"type": "string"},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                    "confidence_rationale": {"type": "string"},
                    "supporting_evidence": _str_list(),
                    "contradicting_evidence": _str_list(),
                    "missing_information": _str_list(),
                    "suspected_location": {
                        "anyOf": [
                            {
                                "type": "object",
                                "additionalProperties": False,
                                "required": ["file", "line", "symbol"],
                                "properties": {
                                    "file": {"type": "string"},
                                    "line": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                                    "symbol": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                                },
                            },
                            {"type": "null"},
                        ]
                    },
                },
            },
        },
        "data_gaps": _str_list(),
    },
}
