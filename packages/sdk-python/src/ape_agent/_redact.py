"""Same rules as the server: secrets never leave the process if we can help it."""

from __future__ import annotations

import re
from typing import Any

_RULES: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
        ),
        "[REDACTED:private_key]",
    ),
    (re.compile(r"\bape_(?:live|alert)_[A-Za-z0-9]{16,}"), "[REDACTED:token]"),
    (
        re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})"),
        "[REDACTED:github_token]",
    ),
    (re.compile(r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}"), "[REDACTED:api_key]"),
    (re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"), "[REDACTED:aws_key]"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}"), "[REDACTED:slack_token]"),
    (
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"),
        "[REDACTED:jwt]",
    ),
    (
        re.compile(r"\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}", re.IGNORECASE),
        r"\1 [REDACTED:token]",
    ),
    (
        re.compile(r"\b([a-z][a-z0-9+.-]*://)[^\s:@/]+:[^\s@/]+@", re.IGNORECASE),
        r"\1[REDACTED:credentials]@",
    ),
    (
        re.compile(
            r"\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*)"
            r"([\"']?)[^\s\"',;]{4,}\2",
            re.IGNORECASE,
        ),
        r"\1[REDACTED:secret]",
    ),
    (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "[REDACTED:card_number]"),
]

_SECRET_KEY = re.compile(
    r"pass(word)?|secret|token|api[-_]?key|authorization|cookie|session", re.IGNORECASE
)


def redact_text(text: str) -> str:
    for pattern, repl in _RULES:
        text = pattern.sub(repl, text)
    return text


def redact_value(value: Any, depth: int = 0) -> Any:
    if isinstance(value, str):
        return redact_text(value)
    if depth > 4:
        return value
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for i, (k, v) in enumerate(value.items()):
            if i >= 64:
                break
            out[str(k)] = (
                "[REDACTED:secret]"
                if _SECRET_KEY.search(str(k))
                else redact_value(v, depth + 1)
            )
        return out
    if isinstance(value, (list, tuple)):
        return [redact_value(v, depth + 1) for v in list(value)[:50]]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return redact_text(repr(value))
