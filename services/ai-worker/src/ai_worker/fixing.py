"""Regression-test and patch generation (Phase 5). Model output is validated before it is stored."""

import json
import re
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from ai_worker.investigate import load_prompt
from ai_worker.llm.gateway import ModelError, ModelProvider

MAX_TEST_CHARS = 20_000
MAX_FAILURE_CHARS = 8_000


class FixContext(BaseModel):
    """Written by the TypeScript prepareFix activity (services/api/src/fixes)."""

    fixProposalId: str
    repository: str
    sha: str
    profile: dict[str, Any]
    incident: dict[str, Any]
    hypothesis: dict[str, Any]
    stack: list[str]
    editable: dict[str, str]
    tests: dict[str, str]
    packageJson: str
    testPath: str


class TestOut(BaseModel):
    content: str = Field(min_length=20, max_length=MAX_TEST_CHARS)
    rationale: str = Field(min_length=1, max_length=1000)


class EditOut(BaseModel):
    path: str
    find: str = Field(min_length=1)
    replace: str


class PatchOut(BaseModel):
    edits: list[EditOut] = Field(min_length=1, max_length=8)
    explanation: str = Field(min_length=1, max_length=2000)


def _closed(props: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": list(props),
        "properties": props,
    }


TEST_SCHEMA = _closed({"content": {"type": "string"}, "rationale": {"type": "string"}})
PATCH_SCHEMA = _closed(
    {
        "edits": {
            "type": "array",
            "items": _closed(
                {
                    "path": {"type": "string"},
                    "find": {"type": "string"},
                    "replace": {"type": "string"},
                }
            ),
        },
        "explanation": {"type": "string"},
    }
)


def _block(tag: str, name: str, body: str) -> str:
    return f'<{tag} path="{name}">\n{body.replace(f"</{tag}>", f"<\\\\/{tag}>")}\n</{tag}>'


def _common(ctx: FixContext) -> list[str]:
    h = ctx.hypothesis
    return [
        f"Repository: {ctx.repository} at commit {ctx.sha}",
        f"Incident: {ctx.incident.get('title')}",
        f"Hypothesis: {h.get('summary')}",
        f"Why: {h.get('rationale') or 'n/a'}",
        f"Suspected location: {json.dumps(h.get('location'))}",
        "",
        "<stack_trace>",
        *ctx.stack,
        "</stack_trace>",
        "",
        *[_block("source", p, c) for p, c in ctx.editable.items()],
    ]


def validate_test(content: str) -> list[str]:
    """Cheap static checks before spending a sandbox run on a test."""
    problems = []
    if "from 'vitest'" not in content and 'from "vitest"' not in content:
        problems.append("does not import from vitest")
    if not re.search(r"\b(it|test)\s*\(", content):
        problems.append("contains no test case")
    if re.search(r"\bfetch\s*\(|https?://|child_process|\beval\s*\(", content):
        problems.append("uses the network, child processes or eval")
    if re.search(r"from ['\"](\.\./)+(\.\./)", content) and "../src" not in content:
        problems.append("imports outside the package")
    return problems


def validate_patch(patch: PatchOut, ctx: FixContext) -> list[str]:
    problems = []
    for e in patch.edits:
        if e.path not in ctx.editable:
            problems.append(f"{e.path} is not an editable file")
        elif ctx.editable[e.path].count(e.find) != 1:
            problems.append(f"find text in {e.path} must match exactly once")
    return problems


async def generate_test(
    ctx: FixContext, provider: ModelProvider, prompt_version: str
) -> tuple[TestOut | None, str | None, dict[str, Any]]:
    user = "\n".join(
        [
            *_common(ctx),
            "",
            *[_block("existing_test", p, c) for p, c in ctx.tests.items()],
            "",
            _block(
                "package_json", f"{ctx.profile.get('packageDir')}/package.json", ctx.packageJson
            ),
            "",
            f"Write the regression test for {ctx.testPath}. "
            "Paths in imports are relative to that file.",
        ]
    )
    return await _structured(
        provider,
        load_prompt(prompt_version),
        user,
        TEST_SCHEMA,
        TestOut,
        lambda t: validate_test(t.content),
    )


async def generate_patch(
    ctx: FixContext,
    test: dict[str, str],
    failure_output: str,
    feedback: str | None,
    provider: ModelProvider,
    prompt_version: str,
) -> tuple[PatchOut | None, str | None, dict[str, Any]]:
    user = "\n".join(
        [
            *_common(ctx),
            "",
            f"Editable files: {', '.join(ctx.editable)}",
            "",
            _block("regression_test", test["path"], test["content"]),
            "",
            "<test_output>",
            failure_output[-MAX_FAILURE_CHARS:],
            "</test_output>",
            *(
                [
                    "",
                    "<previous_attempt_feedback>",
                    feedback[-4000:],
                    "</previous_attempt_feedback>",
                ]
                if feedback
                else []
            ),
            "",
            "Return the edits that make the regression test pass.",
        ]
    )
    return await _structured(
        provider,
        load_prompt(prompt_version),
        user,
        PATCH_SCHEMA,
        PatchOut,
        lambda p: validate_patch(p, ctx),
    )


async def _structured[M: (TestOut, PatchOut)](
    provider: ModelProvider,
    system: str,
    user: str,
    schema: dict[str, Any],
    model_cls: type[M],
    check: Callable[[M], list[str]],
) -> tuple[M | None, str | None, dict[str, Any]]:
    usage: dict[str, Any] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}
    last = "no attempt"
    for _ in range(2):  # one retry on invalid output
        try:
            call = await provider.structured(
                system=system, user=user, schema=schema, purpose=model_cls.__name__
            )
        except ModelError as e:
            if e.retryable:
                raise
            return None, f"{e.reason}: {str(e)[:200]}", usage
        usage["calls"] += 1
        usage["input_tokens"] += call.input_tokens
        usage["output_tokens"] += call.output_tokens
        usage["cost_usd"] = round(usage["cost_usd"] + call.cost_usd, 6)
        usage["model"] = call.model
        try:
            out = model_cls.model_validate_json(call.text)
        except ValidationError as e:
            last = f"invalid output: {str(e)[:300]}"
            continue
        problems = check(out)
        if problems:
            last = "; ".join(problems)
            user += f"\n\nYour previous answer was rejected: {last}. Fix that."
            continue
        return out, None, usage
    return None, last, usage
