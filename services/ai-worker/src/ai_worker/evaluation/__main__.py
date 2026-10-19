"""Evaluation CLI (ADR-021).

    uv run python -m ai_worker.evaluation run                      # scripted reference answers
    uv run python -m ai_worker.evaluation run \
        --models gemini:gemini-3.6-flash anthropic:claude-opus-5-5
    uv run python -m ai_worker.evaluation run --models openai:<model> --repeat 3 --min-pass-rate 0.8

Keys come from services/ai-worker/.env as usual. Exits 1 when a model misses a threshold, so the
same command gates prompt or model changes in CI.
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from ai_worker.config import get_settings
from ai_worker.evaluation.cases import EVAL_DIR, load_answer_key, load_cases
from ai_worker.evaluation.providers import build_target
from ai_worker.evaluation.report import to_markdown
from ai_worker.evaluation.runner import evaluate
from ai_worker.llm.gateway import ModelError


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m ai_worker.evaluation")
    sub = p.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="evaluate models on the frozen cases")
    run.add_argument("--models", nargs="+", default=["scripted:reference"])
    run.add_argument("--cases", type=Path, default=EVAL_DIR / "cases")
    run.add_argument("--key", type=Path, default=EVAL_DIR / "answer-key.json")
    run.add_argument("--only", nargs="+", help="case ids to run")
    run.add_argument("--repeat", type=int, default=1)
    run.add_argument("--prompt-version", default="investigate_v1")
    run.add_argument(
        "--out", type=Path, help="write results JSON (default: tests/evaluation/results/)"
    )
    run.add_argument("--no-save", action="store_true", help="print only")
    run.add_argument("--min-pass-rate", type=float, default=None)
    run.add_argument("--min-top1", type=float, default=None)
    sub.add_parser("list", help="list cases")
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    key = load_answer_key(EVAL_DIR / "answer-key.json" if args.command == "list" else args.key)
    if args.command == "list":
        for c in load_cases(EVAL_DIR / "cases", key):
            print(f"{c.id:24} {c.expect.mode:9} {c.description}")
        return 0

    settings = get_settings()
    try:
        targets = [build_target(spec, settings) for spec in args.models]
    except (ModelError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    cases = load_cases(args.cases, key, args.only)
    run = asyncio.run(
        evaluate(targets, cases, key, prompt_version=args.prompt_version, repeat=args.repeat)
    )

    md = to_markdown(run)
    print(md)
    if not args.no_save:
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        out = args.out or EVAL_DIR / "results" / f"{stamp}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(run.to_json(), indent=2) + "\n", encoding="utf-8")
        out.with_suffix(".md").write_text(md, encoding="utf-8")
        print(f"Saved {out} and {out.with_suffix('.md').name}")

    failed = [
        s.model
        for s in run.summaries
        if (args.min_pass_rate is not None and s.pass_rate < args.min_pass_rate)
        or (args.min_top1 is not None and (s.top1_rate or 0) < args.min_top1)
    ]
    if failed:
        print(f"Below threshold: {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
