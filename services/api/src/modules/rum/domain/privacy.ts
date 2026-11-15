const SKIP_TEXT = /(<(style|script|title)\b[^>]*>[\s\S]*?<\/\2>)/gi;

export function sampled(sessionKey: string, rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  let hash = 0x811c9dc5;
  for (let i = 0; i < sessionKey.length; i++) {
    hash ^= sessionKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 10_000) / 10_000 < rate;
}

export function maskText(html: string): string {
  return html
    .split(SKIP_TEXT)
    .map((part, i) =>
      i % 3 === 0
        ? part.replace(/>([^<]+)</g, (_m, text: string) => `>${text.replace(/\S/g, '•')}<`)
        : i % 3 === 1
          ? part
          : '',
    )
    .join('');
}

export function stripFormValues(html: string): string {
  let out = html;
  for (let pass = 0; pass < 5; pass++) {
    const next = stripOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function stripOnce(html: string): string {
  return html
    .replace(
      /(<(?:input|option)\b[^>]*?)\s(?:value|checked|selected)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,
      '$1',
    )
    .replace(/(<textarea\b[^>]*>)[\s\S]*?(<\/textarea>)/gi, '$1$2');
}

export function enforceReplayPrivacy(html: string, maskAll: boolean): string {
  const clean = stripFormValues(html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, ''));
  return maskAll ? maskText(clean) : clean;
}

export const VITAL_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
};
