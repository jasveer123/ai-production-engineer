import type { MetricHistogram } from '../../../core/db/schema';

export type BucketMap = Map<number, number>;

export interface HistogramSample {
  count: number;
  sum: number | null;
  buckets: BucketMap;
}

export function bucketsOf(h: MetricHistogram): BucketMap {
  const out: BucketMap = new Map();
  const add = (upper: number, n: number) => out.set(upper, (out.get(upper) ?? 0) + n);
  if (h.type === 'explicit') {
    h.counts.forEach((n, i) => add(h.bounds[i] ?? Number.POSITIVE_INFINITY, n));
    return out;
  }
  const base = 2 ** (2 ** -h.scale);
  if (h.zeroCount > 0) add(0, h.zeroCount);
  // shortcut: negative exponential buckets are ignored for quantiles; fine for latency/size data, revisit for signed values.
  h.positive.counts.forEach((n, i) => add(base ** (h.positive.offset + i + 1), n));
  return out;
}

export const sampleOf = (h: MetricHistogram): HistogramSample => ({
  count: h.count,
  sum: h.sum,
  buckets: bucketsOf(h),
});

export function subtract(cur: HistogramSample, prev: HistogramSample): HistogramSample | null {
  if (cur.count < prev.count) return null;
  const buckets: BucketMap = new Map();
  for (const [upper, n] of cur.buckets) {
    const diff = n - (prev.buckets.get(upper) ?? 0);
    if (diff < 0) return null;
    buckets.set(upper, diff);
  }
  for (const upper of prev.buckets.keys()) if (!cur.buckets.has(upper)) return null;
  const sum = cur.sum !== null && prev.sum !== null ? cur.sum - prev.sum : null;
  return { count: cur.count - prev.count, sum, buckets };
}

export function merge(into: HistogramSample, add: HistogramSample): HistogramSample {
  const buckets = new Map(into.buckets);
  for (const [upper, n] of add.buckets) buckets.set(upper, (buckets.get(upper) ?? 0) + n);
  const sum = into.sum !== null && add.sum !== null ? into.sum + add.sum : null;
  return { count: into.count + add.count, sum, buckets };
}

export function histogramQuantile(q: number, buckets: BucketMap): number | null {
  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const total = sorted.reduce((n, [, c]) => n + c, 0);
  if (total <= 0) return null;
  const rank = q * total;
  let cumulative = 0;
  let lower = 0;
  let highestFinite: number | null = null;
  for (const [upper, count] of sorted) {
    if (cumulative + count >= rank && count > 0) {
      if (!Number.isFinite(upper)) return highestFinite;
      if (upper <= 0 && lower === 0) return upper;
      return lower + (upper - lower) * ((rank - cumulative) / count);
    }
    cumulative += count;
    if (Number.isFinite(upper)) {
      lower = upper;
      highestFinite = upper;
    }
  }
  return highestFinite;
}

export function sampleQuantile(q: number, values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
