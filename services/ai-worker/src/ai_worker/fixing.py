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


_NODE_BUILTINS = {
    "assert", "buffer", "crypto", "events", "fs", "http", "https", "os", "path", "stream",
    "timers", "url", "util", "zlib",
}  # fmt: skip
_SKIPPED = re.compile(r"\.(skip|todo|only)\b|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(")
_EMPTY_ASSERT = re.compile(r"expect\(\s*(true|false|1|0|null|undefined)\s*\)\s*\.")
_BARE_IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*['"]([^'"./][^'"]*)['"]""")


def _dependencies(package_json: str | None) -> set[str] | None:
    """Package names a test may import, or None when package.json cannot be read."""
    if not package_json:
        return None
    try:
        data = json.loads(package_json)
    except json.JSONDecodeError:
        return None
    names: set[str] = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        names.update((data.get(key) or {}).keys())
    return names


def _package_name(spec: str) -> str:
    if spec.startswith("node:"):
        return spec
    parts = spec.split("/")
    return "/".join(parts[:2]) if spec.startswith("@") else parts[0]


def validate_test(
    content: str, ctx: FixContext | None = None, package_json: str | None = None
) -> list[str]:
    """Cheap static checks before spending a sandbox run on a test."""
    problems = []
    if "from 'vitest'" not in content and 'from "vitest"' not in content:
        problems.append("does not import from vitest")
    if not re.search(r"\b(it|test)\s*\(", content):
        problems.append("contains no test case")
    if "expect(" not in content and "expect.assertions" not in content:
        problems.append("makes no assertion")
    if _EMPTY_ASSERT.search(content):
        problems.append("asserts a constant, which can never fail")
    if _SKIPPED.search(content):
        problems.append("skips or narrows tests (.skip, .todo, .only, xit)")
    if re.search(r"\bfetch\s*\(|https?://|child_process|\beval\s*\(|process\.exit", content):
        problems.append("uses the network, child processes, eval or process.exit")
    if re.search(r"Math\.random\s*\(|\bsetTimeout\s*\([^)]*,\s*[2-9]\d{3,}", content):
        problems.append("is not deterministic or waits too long")
    if re.search(r"toMatchSnapshot|toMatchInlineSnapshot", content):
        problems.append("uses a snapshot assertion")
    if re.search(r"from ['\"](\.\./)+(\.\./)", content) and "../src" not in content:
        problems.append("imports outside the package")
    deps = _dependencies(
        package_json if package_json is not None else (ctx.packageJson if ctx else None)
    )
    if deps is not None:
        for spec in sorted(set(_BARE_IMPORT.findall(content))):
            name = _package_name(spec)
            if name.startswith("node:") or name in _NODE_BUILTINS:
                continue
            if name != "vitest" and name not in deps:
                problems.append(f"imports {name!r}, which is not in package.json")
    if ctx is not None:
        loc = ctx.hypothesis.get("location") or {}
        stem = str(loc.get("file", "")).rsplit("/", 1)[-1].rsplit(".", 1)[0]
        if stem and re.search(rf"vi\.mock\(\s*['\"][^'\"]*{re.escape(stem)}", content):
            problems.append(f"mocks {stem}, the module under test")
    return problems


_PATCH_CHEATS: list[tuple[str, re.Pattern[str]]] = [
    ("suppresses a compiler or lint check", re.compile(r"@ts-(ignore|expect-error|nocheck)|eslint-disable|\bas any\b")),  # noqa: E501 - regex table
    ("swallows errors with an empty catch", re.compile(r"catch\s*(\([^)]*\))?\s*\{\s*(//[^\n]*)?\s*\}")),  # noqa: E501 - regex table
    ("adds the network, a process, eval or an exit", re.compile(r"\bfetch\s*\(|https?://|child_process|\beval\s*\(|new Function\(|process\.exit")),  # noqa: E501 - regex table
    ("detects that it runs under test", re.compile(r"VITEST|NODE_ENV\s*[=!]==?\s*['\"]test|\bisTest\b|__TEST__")),  # noqa: E501 - regex table
    ("adds a dependency import that may not exist", re.compile(r"\brequire\(\s*['\"](?!\.)")),
]  # fmt: skip
MAX_ADDED_LINES = 80


def _changed_lines(e: "EditOut") -> list[str]:
    """Lines the edit adds: in `replace` and not already in `find` (unchanged context is fine)."""
    before = {line.strip() for line in e.find.splitlines()}
    return [ln for ln in e.replace.splitlines() if ln.strip() and ln.strip() not in before]


def validate_patch(patch: PatchOut, ctx: FixContext) -> list[str]:
    problems = []
    added = 0
    for e in patch.edits:
        if e.path not in ctx.editable:
            problems.append(f"{e.path} is not an editable file")
            continue
        name = e.path.rsplit("/", 1)[-1]
        if re.search(r"\.(test|spec)\.[cm]?[jt]sx?$|^package(-lock)?\.json$|\.ya?ml$", name):
            problems.append(f"{e.path} is a test, manifest or CI file, which a fix may not change")
        if ctx.editable[e.path].count(e.find) != 1:
            problems.append(f"find text in {e.path} must match exactly once")
        if re.sub(r"\s+", "", e.find) == re.sub(r"\s+", "", e.replace):
            problems.append(f"edit in {e.path} changes nothing but whitespace")
        lines = _changed_lines(e)
        added += len(lines)
        text = "\n".join(lines)
        for label, pattern in _PATCH_CHEATS:
            if pattern.search(text):
                problems.append(f"edit in {e.path} {label}")
    if added > MAX_ADDED_LINES:
        problems.append(f"adds {added} lines; a minimal fix stays under {MAX_ADDED_LINES}")
    return problems


async def generate_test(
    ctx: FixContext, provider: ModelProvider, prompt_version: str, *, final_attempt: bool = False
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
        lambda t: validate_test(t.content, ctx),
        final_attempt=final_attempt,
    )


async def generate_patch(
    ctx: FixContext,
    test: dict[str, str],
    failure_output: str,
    feedback: str | None,
    provider: ModelProvider,
    prompt_version: str,
    *,
    final_attempt: bool = False,
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
        final_attempt=final_attempt,
    )


async def _structured[M: (TestOut, PatchOut)](
    provider: ModelProvider,
    system: str,
    user: str,
    schema: dict[str, Any],
    model_cls: type[M],
    check: Callable[[M], list[str]],
    *,
    final_attempt: bool = False,
) -> tuple[M | None, str | None, dict[str, Any]]:
    usage: dict[str, Any] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}
    last = "no attempt"
    for _ in range(2):  # one retry on invalid output
        try:
            call = await provider.structured(
                system=system, user=user, schema=schema, purpose=model_cls.__name__
            )
        except ModelError as e:
            if e.retryable and not final_attempt:
                raise  # Temporal retries; on its last try we report the reason instead
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
