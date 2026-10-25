/** Time ranges the Quality page offers, in days (the API accepts 1 to 365). */
export const RANGES = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;

/** Reads the `days` search param; anything not offered means the default range. */
export function parseDays(value: string | null): number {
  const days = Number(value);
  return (RANGES as readonly number[]).includes(days) ? days : DEFAULT_DAYS;
}

/** Below this many, a percentage says more than the data does, so only the counts are shown. */
export const MIN_SAMPLE = 5;

export type Ratio =
  | { kind: 'none' }
  | { kind: 'few'; part: number; whole: number }
  | { kind: 'rate'; part: number; whole: number; value: number };

export function ratio(part: number, whole: number): Ratio {
  if (whole <= 0) return { kind: 'none' };
  if (whole < MIN_SAMPLE) return { kind: 'few', part, whole };
  return { kind: 'rate', part, whole, value: part / whole };
}
