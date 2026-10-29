const RULES: { kind: string; pattern: RegExp }[] = [
  {
    kind: 'private_key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { kind: 'anthropic_key', pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}/g },
  { kind: 'openai_key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  {
    kind: 'github_token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
  },
  { kind: 'aws_key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'slack_token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'webhook_secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}/g },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { kind: 'bearer', pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  { kind: 'url_credentials', pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi },
  {
    kind: 'assignment',
    pattern:
      /\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*)(["']?)[^\s"',;]{4,}\2/gi,
  },
  { kind: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { kind: 'card_number', pattern: /\b(?:\d[ -]?){13,19}\b/g },
];

export interface RedactionResult {
  text: string;
  counts: Record<string, number>;
}

export function redact(input: string): RedactionResult {
  const counts: Record<string, number> = {};
  let text = input;
  for (const { kind, pattern } of RULES) {
    text = text.replace(pattern, (match: string, ...groups: unknown[]) => {
      counts[kind] = (counts[kind] ?? 0) + 1;

      if (kind === 'assignment') return `${String(groups[0])}[REDACTED:secret]`;
      if (kind === 'url_credentials') return `${String(groups[0])}[REDACTED:credentials]@`;
      if (kind === 'bearer') return `${String(groups[0])} [REDACTED:token]`;
      void match;
      return `[REDACTED:${kind}]`;
    });
  }
  return { text, counts };
}
