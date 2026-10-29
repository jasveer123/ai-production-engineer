export const RANGES = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;

export function parseDays(value: string | null): number {
  const days = Number(value);
  return (RANGES as readonly number[]).includes(days) ? days : DEFAULT_DAYS;
}

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
