"""Guardrails around every model call (ADR-024).

Three layers, all deterministic so they can be tested without a model:

1. Before the call: secrets the collector missed are redacted again, text that tries to instruct
   the model is flagged, and no single evidence item may crowd out the rest.
2. After the call: claims that cannot be checked against the evidence are dropped or weakened
   (invented file paths, over-confident answers, duplicate hypotheses), and anything that looks
   like a secret is scrubbed from the report.
3. Fix steps (fixing.py): generated tests and patches are screened for cheats before a sandbox run.

Guards never invent content. They remove, downgrade or flag, and every change is recorded in the
report's `adjustments` so a person can see what the guard did and why.
"""

import re
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass, field

from ai_worker.report import Hypothesis, ModelReport, Rejected, SuspectedLocation

# ---------------------------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------------------------

_NOT_ALREADY_REDACTED = r"(?!\[REDACTED)"

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "private_key",
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|\Z)"
        ),
    ),
    ("aws_key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b")),
    ("api_key", re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b")),
    ("slack_token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    ("bearer", re.compile(r"(?i)\bbearer\s+" + _NOT_ALREADY_REDACTED + r"[A-Za-z0-9._~+/=-]{20,}")),
    (
        "secret",
        re.compile(
            r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token)"
            r"(\s*[=:]\s*)(['\"]?)" + _NOT_ALREADY_REDACTED + r"[^\s'\",;]{8,}"
        ),
    ),
]


def redact_text(text: str) -> tuple[str, Counter[str]]:
    """Replaces anything that still looks like a secret. Idempotent: redacted text is left alone."""
    found: Counter[str] = Counter()

    def sub(kind: str) -> Callable[[re.Match[str]], str]:
        def inner(m: re.Match[str]) -> str:
            found[kind] += 1
            if kind == "secret":  # keep the name, drop the value: "password=[REDACTED:secret]"
                return f"{m.group(1)}{m.group(2)}{m.group(3)}[REDACTED:secret]"
            return f"[REDACTED:{kind}]"

        return inner

    for kind, pattern in SECRET_PATTERNS:
        text = pattern.sub(sub(kind), text)
    return text, found


# ---------------------------------------------------------------------------------------------
# Prompt injection
# ---------------------------------------------------------------------------------------------

INJECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "ignore_instructions",
        re.compile(
            r"(?i)\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|prompts?|rules)\b"
        ),
    ),
    ("new_instructions", re.compile(r"(?i)\b(new|updated|real)\s+instructions?\s*:")),
    ("role_tags", re.compile(r"(?i)</?\s*(system|assistant|developer|instructions?)\s*>")),
    (
        "approve_or_merge",
        re.compile(
            r"(?i)\b(approve|merge|ship|deploy|rollback|roll back)\b.{0,25}\b(this|the)\s+(fix|pr|pull request|patch|change)\b"  # noqa: E501 - regex table
        ),
    ),
    (
        "address_ai",
        re.compile(
            r"(?i)\b(assistant|ai model|language model|llm|claude|gpt)\b.{0,30}\b(must|should|please|now)\b"  # noqa: E501 - regex table
        ),
    ),
    (
        "reveal_secrets",
        re.compile(
            r"(?i)\b(reveal|print|show|output|leak)\b.{0,30}\b(system prompt|instructions|api key|secret|password|token)\b"  # noqa: E501 - regex table
        ),
    ),
    (
        "hide_from_user",
        re.compile(r"(?i)\b(do not|don't|never)\s+(tell|report|mention|show|reveal)\b"),
    ),
]


def scan_injection(text: str) -> list[str]:
    return [label for label, pattern in INJECTION_PATTERNS if pattern.search(text)]


MAX_ITEM_CHARS = 12_000


def cap_item(text: str, limit: int = MAX_ITEM_CHARS) -> tuple[str, int]:
    """Keeps the start and the end (errors are usually at one of them) and says what was cut."""
    if len(text) <= limit:
        return text, 0
    head = limit * 2 // 3
    tail = limit - head
    cut = len(text) - head - tail
    return f"{text[:head]}\n[... {cut} characters omitted by the platform ...]\n{text[-tail:]}", cut


@dataclass
class ScreenedItem:
    ref: str
    content: str
    injection: list[str] = field(default_factory=list)
    redactions: Counter[str] = field(default_factory=Counter)
    omitted_chars: int = 0


def screen_item(ref: str, title: str, content: str) -> ScreenedItem:
    """One evidence item, made safe to send: secrets redacted, injection flagged, size capped."""
    redacted, found = redact_text(content)
    redacted_title, found_title = redact_text(title)
    found.update(found_title)
    capped, omitted = cap_item(redacted)
    # Scan the original text: redaction cannot hide an instruction, and the cap must not either.
    return ScreenedItem(
        ref=ref,
        content=capped,
        injection=sorted(set(scan_injection(content) + scan_injection(redacted_title))),
        redactions=found,
        omitted_chars=omitted,
    )


# ---------------------------------------------------------------------------------------------
# Output guards
# ---------------------------------------------------------------------------------------------

CODE_KINDS = {"code"}
STRONG_KINDS = {"code", "error_event", "trace", "commit"}
MAX_OBSERVATIONS = 12


@dataclass
class GuardResult:
    report: ModelReport
    rejected: list[Rejected] = field(default_factory=list)
    adjustments: list[str] = field(default_factory=list)


def _path_tokens(path: str) -> set[str]:
    p = path.strip().replace("\\", "/").lstrip("./")
    base = p.rsplit("/", 1)[-1]
    return {t for t in {p, base} if len(t) >= 3}


def ground_location(
    loc: SuspectedLocation | None, corpus: str
) -> tuple[SuspectedLocation | None, str | None]:
    """A suspected file must appear in the evidence. Models invent plausible paths otherwise."""
    if loc is None:
        return None, None
    if any(t in corpus for t in _path_tokens(loc.file)):
        return loc, None
    return None, f"removed suspected location {loc.file!r}: no evidence item mentions that path"


def calibrate(
    h: Hypothesis, kinds: dict[str, str], has_code: bool
) -> tuple[Hypothesis, str | None]:
    """Caps confidence the evidence cannot support. Never raises it."""
    if h.confidence != "high":
        return h, None
    reasons = []
    supporting = {e for e in h.supporting_evidence if e in kinds}
    if not has_code:
        reasons.append("no code was available")
    if len(supporting) < 2:
        reasons.append("only one evidence item supports it")
    elif not any(kinds[e] in STRONG_KINDS for e in supporting):
        reasons.append("no stack trace, code or commit supports it")
    if h.contradicting_evidence:
        reasons.append("some evidence argues against it")
    if not reasons:
        return h, None
    h.confidence = "medium"
    return h, f"lowered hypothesis {h.rank} from high to medium: {'; '.join(reasons)}"


_WORD = re.compile(r"[a-z0-9_]+")


def _similar(a: str, b: str) -> float:
    ta, tb = set(_WORD.findall(a.lower())), set(_WORD.findall(b.lower()))
    return len(ta & tb) / len(ta | tb) if ta | tb else 0.0


def _same_cause(a: Hypothesis, b: Hypothesis) -> bool:
    la, lb = a.suspected_location, b.suspected_location
    if la and lb and la.file == lb.file and la.symbol and la.symbol == lb.symbol:
        return True
    return _similar(a.summary, b.summary) >= 0.75


def _scrub(text: str, found: Counter[str]) -> str:
    out, c = redact_text(text)
    found.update(c)
    return out


def scrub_report(report: ModelReport) -> tuple[ModelReport, Counter[str]]:
    """Removes anything secret-like the model wrote, in every free-text field."""
    found: Counter[str] = Counter()
    for o in report.observations:
        o.statement = _scrub(o.statement, found)
    for h in report.hypotheses:
        h.summary = _scrub(h.summary, found)
        h.confidence_rationale = _scrub(h.confidence_rationale, found)
        h.missing_information = [_scrub(m, found) for m in h.missing_information]
    report.data_gaps = [_scrub(g, found) for g in report.data_gaps]
    return report, found


def apply_evidence_guard(
    report: ModelReport, known: set[str]
) -> tuple[ModelReport, list[Rejected]]:
    """Drops claims that cite no evidence or cite ids that do not exist (hallucination guard)."""
    rejected: list[Rejected] = []

    observations = []
    for o in report.observations:
        unknown = [e for e in o.evidence if e not in known]
        if not o.evidence or unknown:
            reason = f"cites unknown evidence {unknown}" if unknown else "cites no evidence"
            rejected.append(Rejected(kind="observation", text=o.statement, reason=reason))
        else:
            observations.append(o)

    hypotheses = []
    for h in sorted(report.hypotheses, key=lambda h: h.rank):
        unknown = [e for e in h.supporting_evidence + h.contradicting_evidence if e not in known]
        if not h.supporting_evidence or unknown:
            reason = (
                f"cites unknown evidence {unknown}" if unknown else "has no supporting evidence"
            )
            rejected.append(Rejected(kind="hypothesis", text=h.summary, reason=reason))
        else:
            hypotheses.append(h)
    for i, h in enumerate(hypotheses, start=1):  # keep ranks contiguous after drops
        h.rank = i

    return (
        ModelReport(observations=observations, hypotheses=hypotheses, data_gaps=report.data_gaps),
        rejected,
    )


def guard_report(report: ModelReport, items: list[tuple[str, str, str, str]]) -> GuardResult:
    """Applies the output guards. `items` are (ref, kind, title, content) of the evidence sent."""
    kinds = {ref: kind for ref, kind, *_ in items}
    corpus = "\n".join(f"{title}\n{content}" for _, _, title, content in items)
    has_code = any(k in CODE_KINDS for k in kinds.values())

    # 1. Claims must cite evidence that exists.
    cited, rejected = apply_evidence_guard(report, set(kinds))
    out = GuardResult(report=cited, rejected=rejected)

    observations = cited.observations
    if len(observations) > MAX_OBSERVATIONS:
        out.adjustments.append(
            f"kept the first {MAX_OBSERVATIONS} of {len(observations)} observations"
        )
        observations = observations[:MAX_OBSERVATIONS]

    hypotheses: list[Hypothesis] = []
    for h in cited.hypotheses:
        # 2. A source cannot both support and contradict the same hypothesis.
        both = set(h.supporting_evidence) & set(h.contradicting_evidence)
        if both:
            h.contradicting_evidence = [e for e in h.contradicting_evidence if e not in both]
            out.adjustments.append(
                f"hypothesis {h.rank}: {sorted(both)} were listed as both supporting and "
                "contradicting; kept as supporting"
            )
        # 3. The suspected location must be grounded in the evidence.
        h.suspected_location, note = ground_location(h.suspected_location, corpus)
        if note:
            out.adjustments.append(f"hypothesis {h.rank}: {note}")
        # 4. Confidence the evidence cannot carry.
        calibrated, note = calibrate(h, kinds, has_code)
        if note:
            out.adjustments.append(note)
        hypotheses.append(calibrated)

    # 5. Duplicate causes are one cause.
    unique: list[Hypothesis] = []
    for h in hypotheses:
        twin = next((u for u in unique if _same_cause(u, h)), None)
        if twin:
            out.rejected.append(
                Rejected(
                    kind="hypothesis",
                    text=h.summary,
                    reason=f"duplicate of hypothesis {twin.rank}",
                )
            )
        else:
            unique.append(h)
    for i, h in enumerate(unique, start=1):  # keep ranks contiguous after drops
        h.rank = i

    guarded = ModelReport(observations=observations, hypotheses=unique, data_gaps=cited.data_gaps)
    # 6. Nothing secret-like leaves in the report.
    guarded, found = scrub_report(guarded)
    if found:
        listed = ", ".join(f"{k} x{n}" for k, n in sorted(found.items()))
        out.adjustments.append(f"redacted secret-like text the model wrote ({listed})")
    out.report = guarded
    return out
