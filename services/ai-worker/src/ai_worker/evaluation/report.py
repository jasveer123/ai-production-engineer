"""Markdown report for an evaluation run."""

from ai_worker.evaluation.runner import EvalRun
from ai_worker.evaluation.scoring import ModelSummary


def _pct(v: float | None) -> str:
    return "n/a" if v is None else f"{round(v * 100)}%"


def _cost(s: ModelSummary) -> str:
    if s.unpriced:
        return "unpriced"
    return f"${s.cost_usd:.4f}"


def to_markdown(run: EvalRun) -> str:
    lines = [
        f"# Investigation evaluation, {run.started_at}",
        "",
        f"Prompt `{run.prompt_version}`, {len(run.cases)} cases x {run.repeat} run(s) per model.",
        "",
        "| Model | Pass | Top-1 | Top-3 | Abstains | Resists injection | Overconfident"
        " | Guard downgrades | Invented paths | Secrets written | Guard drops | Invalid | Errors"
        " | Cost | p50 latency |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for s in run.summaries:
        lines.append(
            f"| `{s.model}` | {s.passed}/{s.runs} ({_pct(s.pass_rate)}) | {_pct(s.top1_rate)}"
            f" | {_pct(s.top3_rate)} | {_pct(s.abstain_rate)} | {_pct(s.injection_resistance)}"
            f" | {s.overconfident} | {s.guard_downgrades} | {s.invented_locations}"
            f" | {s.leaked_secrets} | {s.guard_rejections} | {s.invalid_outputs} | {s.errors}"
            f" | {_cost(s)} | {s.latency_p50_ms / 1000:.1f}s |"
        )
    lines += [
        "",
        "Top-1/Top-3: the answer key's cause is hypothesis 1 / among the hypotheses. Abstains: no"
        " confident hypothesis when the evidence cannot support one. Guard drops: claims removed"
        " for citing missing evidence. Guard downgrades: times the model said high confidence and"
        " the evidence could not carry it. Invented paths: files the model named that no evidence"
        " mentions. Unpriced: the model has no price in the gateway table.",
        "",
        "## Per case",
        "",
        "| Model | Case | Result | Hypothesis 1 | Notes |",
        "|---|---|---|---|---|",
    ]
    for c in run.scores:
        result = "pass" if c.passed else "**fail**"
        h1 = (
            f"({c.top1_confidence}) {c.top1_summary[:140]}"
            if c.top1_summary
            else (c.error or c.reason or "no hypotheses")
        )
        notes = "; ".join(c.notes)
        lines.append(f"| `{c.model}` | {c.case_id} | {result} | {h1.replace('|', '/')} | {notes} |")
    return "\n".join(lines) + "\n"
