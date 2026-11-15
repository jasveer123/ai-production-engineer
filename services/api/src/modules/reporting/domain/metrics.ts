export interface LifecycleRow {
  startedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  isResolved: boolean;
}

export interface WindowFilter {
  timezone: string;
  businessHours: boolean;
  weekdays: boolean;
}

const BUSINESS_START = 9;
const BUSINESS_END = 17;
const MAX_DAYS = 366;
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    hour: Number(get('hour')) % 24,
    day: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

// Business hours mean 09:00-17:00 local time; weekdays mean Monday to Friday.
export function inWindow(date: Date, f: WindowFilter): boolean {
  if (!f.businessHours && !f.weekdays) return true;
  const { weekday, hour } = localParts(date, f.timezone);
  if ((f.weekdays || f.businessHours) && weekday > 4) return false;
  return !f.businessHours || (hour >= BUSINESS_START && hour < BUSINESS_END);
}

const mean = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

const seconds = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 1000);

// MTTA/MTTR come only from recorded lifecycle times; incidents without them are excluded and counted.
export function responseTimes(rows: LifecycleRow[]) {
  const acked = rows.filter((r) => r.acknowledgedAt);
  const resolved = rows.filter((r) => r.resolvedAt);
  return {
    acknowledged: acked.length,
    resolved: rows.filter((r) => r.isResolved).length,
    mttaSeconds: mean(acked.map((r) => seconds(r.startedAt, r.acknowledgedAt!))),
    mttrSeconds: mean(resolved.map((r) => seconds(r.startedAt, r.resolvedAt!))),
    unacknowledged: rows.length - acked.length,
    unresolved: rows.filter((r) => !r.isResolved).length,
    missingTimestamps: rows.filter((r) => r.isResolved && !r.resolvedAt).length,
  };
}

export function heatmap(rows: LifecycleRow[], timezone: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of rows) {
    const { weekday, hour } = localParts(r.startedAt, timezone);
    grid[weekday]![hour]! += 1;
  }
  return grid;
}

export function dailySeries(rows: LifecycleRow[], from: Date, to: Date, timezone: string) {
  const days = new Map<string, { day: string; started: number; resolved: number }>();
  for (let t = from.getTime(), n = 0; t <= to.getTime() && n < MAX_DAYS; t += 86_400_000, n++) {
    const day = localParts(new Date(t), timezone).day;
    days.set(day, { day, started: 0, resolved: 0 });
  }
  for (const r of rows) {
    const s = days.get(localParts(r.startedAt, timezone).day);
    if (s) s.started += 1;
    if (r.resolvedAt && r.resolvedAt <= to) {
      const d = days.get(localParts(r.resolvedAt, timezone).day);
      if (d) d.resolved += 1;
    }
  }
  return [...days.values()];
}

export function overlapSeconds(start: Date, end: Date | null, from: Date, to: Date, now: Date) {
  const s = Math.max(start.getTime(), from.getTime());
  const e = Math.min((end ?? now).getTime(), to.getTime());
  return Math.max(0, (e - s) / 1000);
}
