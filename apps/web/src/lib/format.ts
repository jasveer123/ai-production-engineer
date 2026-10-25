/** Display helpers. Pure and locale-fixed so server and client render the same text. */

const COUNT = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return COUNT.format(value);
}

/** 0.4231 → "42%"; values are fractions between 0 and 1. */
export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

/** Milliseconds as "840 ms", "4.2 s", "3 min" or "1 h 5 min". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** ISO timestamp → "Oct 20, 10:42" in UTC, so output never depends on the viewer's zone. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month} ${date.getUTCDate()}, ${hh}:${mm}`;
}

/** ISO timestamp → "10:42:07.143" (UTC) for log lines. */
export function formatLogTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

/** Time between two ISO timestamps, as text ("12 min"). */
export function formatElapsed(fromIso: string, toIso: string): string {
  return formatDuration(new Date(toIso).getTime() - new Date(fromIso).getTime());
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** 185000 → "₹1,85,000" (Indian grouping). */
export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return INR.format(Math.round(value));
}

/** 760000 → "₹7.6L", 32000000 → "₹3.2Cr", 4500 → "₹4.5K": short form for headlines. */
export function formatInrCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const one = (n: number) =>
    n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `₹${one(value / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${one(value / 1e5)}L`;
  if (abs >= 1e3) return `₹${one(value / 1e3)}K`;
  return `₹${Math.round(value)}`;
}

/** 1 → "1 person", 33 → "33 people". */
export function formatPeople(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'person' : 'people'}`;
}

/** "just now", "4 min ago", "3 h ago", "2 d ago"; null as "never". */
export function formatAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}
