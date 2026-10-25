"""Activity contracts shared with the TypeScript side (workflows/temporal/src/contracts.ts)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p.title() for p in rest)


class _Camel(BaseModel):
    """Temporal's TypeScript client sends camelCase JSON."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)


class InvestigateInput(_Camel):
    investigation_id: str
    workspace_id: str
    bundle_ref: str
    prompt_version: str


class InvestigateResult(_Camel):
    status: Literal["completed", "needs_review"]
    reason: str | None = None
    report_ref: str | None = None
    model: str | None = None


class EvidenceItem(BaseModel):
    ref: str = Field(pattern=r"^E\d+$")
    id: str
    kind: str
    title: str
    source: str
    source_url: str | None = Field(default=None, alias="sourceUrl")
    content: str

    model_config = ConfigDict(populate_by_name=True)


class IncidentSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=_to_camel)

    id: str
    title: str
    severity: str
    service_name: str | None = None
    environment: str | None = None
    repository_full_name: str | None = None
    first_seen_at: str
    last_seen_at: str
    event_count: int


class EvidenceBundle(BaseModel):
    """Written by the TypeScript collectEvidence activity; already redacted."""

    version: Literal[1]
    investigation_id: str = Field(alias="investigationId")
    incident: IncidentSummary
    note: str | None = None
    coverage: dict[str, object]
    items: list[EvidenceItem]

    model_config = ConfigDict(populate_by_name=True)
