"""Model specs for evaluation runs: `provider:model`, or `scripted:<name>` for fixed answers."""

from pathlib import Path
from typing import Any

from ai_worker.config import Settings
from ai_worker.evaluation.cases import EVAL_DIR
from ai_worker.llm.gateway import (
    AnthropicProvider,
    ModelCall,
    ModelError,
    ModelNotConfigured,
    ModelProvider,
)


class ScriptedProvider:
    """Returns a stored answer per case: hand-written fixtures that test the harness itself.

    Not model output. `reference` answers what a correct analyst would say; `flawed` makes the
    mistakes the harness must catch (invented citations, followed injections, overconfidence).
    """

    def __init__(self, name: str, directory: Path | None = None) -> None:
        self.name = "scripted"
        self.label = f"scripted:{name}"
        self.directory = directory or EVAL_DIR / "scripted" / name
        if not self.directory.is_dir():
            raise ModelNotConfigured(f"No scripted answers at {self.directory}")
        self.case_id: str | None = None

    def for_case(self, case_id: str) -> "ScriptedProvider":
        clone = ScriptedProvider(self.label.split(":", 1)[1], self.directory)
        clone.case_id = case_id
        return clone

    async def structured(
        self, *, system: str, user: str, schema: dict[str, Any], purpose: str
    ) -> ModelCall:
        path = self.directory / f"{self.case_id}.json"
        if not path.is_file():
            raise ModelError(f"No scripted answer for case {self.case_id}")
        return ModelCall(
            text=path.read_text(encoding="utf-8"),
            model=self.label,
            input_tokens=0,
            output_tokens=0,
            cost_usd=0.0,
            latency_ms=0,
        )


class EvalTarget:
    """One model to evaluate. `for_case` lets scripted providers pick the answer per case."""

    def __init__(self, label: str, provider: ModelProvider) -> None:
        self.label = label
        self.provider = provider

    def for_case(self, case_id: str) -> ModelProvider:
        if isinstance(self.provider, ScriptedProvider):
            return self.provider.for_case(case_id)
        return self.provider


def build_target(spec: str, settings: Settings) -> EvalTarget:
    """`anthropic:<model>`, `gemini:<model>`, `openai:<model>` or `scripted:<name>`.

    The model is pinned: Gemini's free-tier fallback is turned off so a comparison never mixes
    models without saying so.
    """
    kind, _, model = spec.partition(":")
    if not model:
        raise ValueError(f"Use provider:model, got {spec!r}")
    if kind == "scripted":
        return EvalTarget(spec, ScriptedProvider(model))
    if kind == "anthropic":
        return EvalTarget(spec, AnthropicProvider(settings.model_copy(update={"ai_model": model})))
    if kind == "gemini":
        from ai_worker.llm.gemini import GeminiProvider

        pinned = settings.model_copy(update={"gemini_model": model, "gemini_fallback_models": []})
        return EvalTarget(spec, GeminiProvider(pinned))
    if kind == "openai":
        from ai_worker.llm.openai_provider import OpenAIProvider

        return EvalTarget(spec, OpenAIProvider(settings.model_copy(update={"openai_model": model})))
    raise ValueError(f"Unknown provider {kind!r} (anthropic, gemini, openai, scripted)")
