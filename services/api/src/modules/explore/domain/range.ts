const UNIT_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export class RangeError extends Error {}

export interface TimeWindow {
  from: Date;
  to: Date;
}

export function resolveRange(
  input: { range?: string; from?: string; to?: string },
  maxDays: number,
  now = Date.now(),
): TimeWindow {
  const to = input.to ? new Date(input.to) : new Date(now);
  let from: Date;
  if (input.from) from = new Date(input.from);
  else {
    const m = /^(\d+)([mhd])$/.exec(input.range ?? '1h');
    if (!m) throw new RangeError('Unknown range');
    from = new Date(to.getTime() - Number(m[1]) * UNIT_MS[m[2]!]!);
  }
  if (from >= to) throw new RangeError('The start of the range must be before the end');
  if (to.getTime() - from.getTime() > maxDays * UNIT_MS.d!)
    throw new RangeError(`Ranges are limited to ${maxDays} days`);
  return { from, to };
}

export interface Cursor {
  ts: string;
  id: number;
}

export const encodeCursor = (c: Cursor) =>
  Buffer.from(JSON.stringify([c.ts, c.id])).toString('base64url');

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      Array.isArray(value) &&
      typeof value[0] === 'string' &&
      !Number.isNaN(Date.parse(value[0])) &&
      Number.isSafeInteger(value[1])
    )
      return { ts: value[0], id: value[1] as number };
  } catch {
    return null;
  }
  return null;
}

export function bucketWidth(window: TimeWindow, buckets: number): number {
  return Math.max(1000, Math.ceil((window.to.getTime() - window.from.getTime()) / buckets));
}
