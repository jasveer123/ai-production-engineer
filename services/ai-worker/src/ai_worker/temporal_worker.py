"""Temporal worker for the `ai` task queue: runs the `investigate` activity (ADR-015)."""

import asyncio
import logging
from typing import Any

from temporalio import activity
from temporalio.client import Client
from temporalio.worker import Worker

from ai_worker.artifacts import ArtifactStore
from ai_worker.config import get_settings
from ai_worker.contracts import EvidenceBundle, InvestigateInput, InvestigateResult
from ai_worker.fixing import FixContext, generate_patch, generate_test
from ai_worker.investigate import run_investigation
from ai_worker.llm.gateway import ModelProvider, get_provider
from ai_worker.telemetry import setup_tracing

log = logging.getLogger("ai_worker")


class InvestigateActivities:
    def __init__(self, store: ArtifactStore, provider: ModelProvider) -> None:
        self.store = store
        self.provider = provider

    @activity.defn(name="investigate")
    async def investigate(self, raw: dict[str, Any]) -> dict[str, Any]:
        inp = InvestigateInput.model_validate(raw)
        bundle = EvidenceBundle.model_validate(await self.store.get_json(inp.bundle_ref))
        report = await run_investigation(bundle, self.provider, inp.prompt_version)
        ref = await self.store.put_json(
            f"reports/{inp.workspace_id}/{inp.investigation_id}/report.json",
            report.model_dump(mode="json"),
        )
        log.info(
            "investigation %s -> %s (%s), $%.4f",
            inp.investigation_id,
            report.status,
            report.reason,
            report.usage.cost_usd,
        )
        result = InvestigateResult(
            status=report.status, reason=report.reason, report_ref=ref, model=report.model
        )
        return result.model_dump(by_alias=True)

    @activity.defn(name="generateTest")
    async def generate_test(self, raw: dict[str, Any]) -> dict[str, Any]:
        ctx = FixContext.model_validate(await self.store.get_json(raw["contextRef"]))
        out, problem, usage = await generate_test(ctx, self.provider, raw["promptVersion"])
        if out is None:
            log.warning("generateTest %s failed: %s", raw["fixProposalId"], problem)
            return {"status": "failed", "reason": problem, "testRef": None, "rationale": None}
        ref = await self.store.put_json(
            f"fixes/{raw['workspaceId']}/{raw['fixProposalId']}/test.json",
            {
                "path": raw["testPath"],
                "content": out.content,
                "rationale": out.rationale,
                "usage": usage,
            },
        )
        return {"status": "ok", "reason": None, "testRef": ref, "rationale": out.rationale}

    @activity.defn(name="generatePatch")
    async def generate_patch(self, raw: dict[str, Any]) -> dict[str, Any]:
        ctx = FixContext.model_validate(await self.store.get_json(raw["contextRef"]))
        test = await self.store.get_json(raw["testRef"])
        run = await self.store.get_json(raw["failureRef"])
        failure = f"{run.get('stdout', '')}\n{run.get('stderr', '')}"
        out, problem, usage = await generate_patch(
            ctx, test, failure, raw.get("feedback"), self.provider, raw["promptVersion"]
        )
        if out is None:
            log.warning("generatePatch %s failed: %s", raw["fixProposalId"], problem)
            return {"status": "failed", "reason": problem, "patchRef": None, "explanation": None}
        ref = await self.store.put_json(
            f"fixes/{raw['workspaceId']}/{raw['fixProposalId']}/attempt-{raw['attempt']}/patch.json",
            {**out.model_dump(), "usage": usage},
        )
        return {"status": "ok", "reason": None, "patchRef": ref, "explanation": out.explanation}


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    settings = get_settings()
    setup_tracing(settings)
    provider = get_provider(settings)
    if provider.name == "none":
        log.warning("No model API key is set: investigations will end as needs_review")
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
    acts = InvestigateActivities(ArtifactStore(settings), provider)
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        activities=[acts.investigate, acts.generate_test, acts.generate_patch],
        max_concurrent_activities=4,  # bounds parallel model spend
    )
    log.info(
        "AI worker polling task queue %r (provider %s, model %s)",
        settings.temporal_task_queue,
        provider.name,
        settings.gemini_model if provider.name == "gemini" else settings.ai_model,
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
