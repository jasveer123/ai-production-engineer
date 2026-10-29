const RULES: [RegExp, string | ((...m: string[]) => string)][] = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    '[REDACTED:private_key]',
  ],
  [/\bape_(?:live|alert)_[A-Za-z0-9]{16,}/g, '[REDACTED:token]'],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '[REDACTED:github_token]'],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, '[REDACTED:api_key]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED:aws_key]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED:slack_token]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[REDACTED:jwt]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, (_m, scheme) => `${scheme} [REDACTED:token]`],
  [
    /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi,
    (_m, scheme) => `${scheme}[REDACTED:credentials]@`,
  ],
  [
    /\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*)(["']?)[^\s"',;]{4,}\2/gi,
    (_m, key) => `${key}[REDACTED:secret]`,
  ],
  [/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED:card_number]'],
];

const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session/i;

export function redactText(input: string): string {
  let out = input;
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement as never);
  return out;
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 64)) {
    out[k] = SECRET_KEY.test(k) ? '[REDACTED:secret]' : redactValue(v, depth + 1);
  }
  return out;
}
