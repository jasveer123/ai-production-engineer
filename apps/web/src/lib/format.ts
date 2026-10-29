const COUNT = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return COUNT.format(value);
}

export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

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

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${month} ${date.getUTCDate()}, ${hh}:${mm}`;
}

export function formatLogTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

export function formatElapsed(fromIso: string, toIso: string): string {
  return formatDuration(new Date(toIso).getTime() - new Date(fromIso).getTime());
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return INR.format(Math.round(value));
}

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

export function formatPeople(count: number): string {
  return `${formatCount(count)} ${count === 1 ? 'person' : 'people'}`;
}

export function formatAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}
