"""Guards the TypeScript <-> Python activity boundary (ADR-015) with Temporal's real converter."""

import json
from typing import Any, get_type_hints

from temporalio.converter import DataConverter

from ai_worker.contracts import InvestigateInput, InvestigateResult
from ai_worker.temporal_worker import InvestigateActivities


async def test_activity_input_from_typescript_decodes() -> None:
    # Exactly what the TypeScript workflow sends (camelCase JSON).
    ts_payload = {
        "investigationId": "inv-1",
        "workspaceId": "ws-1",
        "bundleRef": "s3://ape-artifacts/evidence/ws-1/inv-1/bundle.json",
        "promptVersion": "investigate_v1",
    }
    converter = DataConverter.default
    payloads = await converter.encode([ts_payload])
    arg_type = get_type_hints(InvestigateActivities.investigate)["raw"]
    (decoded,) = await converter.decode(payloads, type_hints=[arg_type])
    parsed = InvestigateInput.model_validate(decoded)
    assert parsed.bundle_ref.endswith("bundle.json")


def test_activity_result_is_camel_case_for_typescript() -> None:
    out: dict[str, Any] = InvestigateResult(
        status="needs_review", reason="no_model_configured", report_ref="s3://b/k", model=None
    ).model_dump(by_alias=True)
    assert json.loads(json.dumps(out)) == {
        "status": "needs_review",
        "reason": "no_model_configured",
        "reportRef": "s3://b/k",
        "model": None,
    }
