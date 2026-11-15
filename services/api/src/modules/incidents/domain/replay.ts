export interface ReplayTarget {
  url: string;
  method?: string | null;
  headers?: unknown;
  body?: string | null;
  timeoutSeconds?: number | null;
  basicAuthUser?: string | null;
  followRedirects?: boolean | null;
}

const SECRET_HEADER = /auth|cookie|token|secret|key|password|session|signature/i;
const REDACTED = '<redacted>';

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export const plainText = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

export function pairsOf(v: unknown, keyField: 'name' | 'key'): [string, string][] {
  if (Array.isArray(v))
    return v.flatMap((e: unknown): [string, string][] => {
      const r = e as Record<string, unknown> | null;
      const k = r?.[keyField];
      return typeof k === 'string' ? [[k, plainText(r?.value)]] : [];
    });
  if (v && typeof v === 'object')
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, plainText(val)]);
  return [];
}

export function buildCurlCommand(t: ReplayTarget): string {
  const method = (t.method ?? 'GET').toUpperCase();
  const parts = ['curl', '-i'];
  if (method === 'HEAD') parts.push('-I');
  else if (method !== 'GET') parts.push('-X', method);
  if (t.followRedirects !== false) parts.push('-L');
  if (t.timeoutSeconds) parts.push('--max-time', String(t.timeoutSeconds));
  for (const [name, value] of pairsOf(t.headers, 'name'))
    parts.push('-H', quote(`${name}: ${SECRET_HEADER.test(name) ? REDACTED : value}`));
  if (t.basicAuthUser) parts.push('-u', quote(`${t.basicAuthUser}:${REDACTED}`));
  if (t.body && method !== 'GET' && method !== 'HEAD') parts.push('--data-raw', quote(t.body));
  parts.push(quote(t.url));
  return parts.join(' ');
}
