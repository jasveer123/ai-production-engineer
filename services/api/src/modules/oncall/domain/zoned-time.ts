const DAY_MS = 86_400_000;
const formats = new Map<string, Intl.DateTimeFormat>();

function format(timeZone: string): Intl.DateTimeFormat {
  let f = formats.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formats.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    format(timeZone);
    return true;
  } catch {
    return false;
  }
}

function wallClockMs(instant: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const p of format(timeZone).formatToParts(new Date(instant)))
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  return Date.UTC(parts.year!, parts.month! - 1, parts.day, parts.hour, parts.minute, parts.second);
}

const offsetAt = (instant: number, timeZone: string) =>
  wallClockMs(instant, timeZone) - Math.floor(instant / 1000) * 1000;

export const dayNumber = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;

export const weekdayOf = (day: number): number => (((day + 4) % 7) + 7) % 7;

export function localDayOf(instant: Date, timeZone: string): number {
  return Math.floor(wallClockMs(instant.getTime(), timeZone) / DAY_MS);
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

/**
 * Converts a local wall-clock time to an instant. A time skipped by a spring-forward change maps to
 * the same moment shifted forward by the gap; a repeated fall-back time maps to its first occurrence.
 */
export function zonedToUtc(day: number, minutes: number, timeZone: string): Date {
  const wall = day * DAY_MS + minutes * 60_000;
  const before = offsetAt(wall - DAY_MS, timeZone);
  const after = offsetAt(wall + DAY_MS, timeZone);
  const valid = [wall - before, wall - after]
    .filter((t) => wallClockMs(t, timeZone) === wall)
    .sort((a, b) => a - b);
  return new Date(valid[0] ?? wall - before);
}
