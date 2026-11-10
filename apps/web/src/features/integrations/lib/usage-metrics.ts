import { RECENT_BUCKETS_FOR_RATE, SPARKLINE_BUCKETS } from "../constants"
import type { HistogramBucket } from "../schemas"

const MINUTE_MS = 60_000

export interface UsageSummary {
  perMinute: number
  hourTotal: number
  hourErrors: number
  recent: HistogramBucket[]
  all: HistogramBucket[]
  peakIndex: number
}

export function summarizeUsage(buckets: HistogramBucket[]): UsageSummary {
  const first = buckets[0]
  const second = buckets[1]
  const bucketMinutes =
    first && second ? (new Date(second.at).getTime() - new Date(first.at).getTime()) / MINUTE_MS : 1

  const latest = buckets.slice(-RECENT_BUCKETS_FOR_RATE)
  const latestTotal = latest.reduce((sum, bucket) => sum + bucket.total, 0)
  const perMinute = latest.length ? latestTotal / (latest.length * bucketMinutes) : 0

  const peakIndex = buckets.reduce(
    (best, bucket, index) => (bucket.total > (buckets[best]?.total ?? 0) ? index : best),
    0
  )

  return {
    perMinute,
    hourTotal: buckets.reduce((sum, bucket) => sum + bucket.total, 0),
    hourErrors: buckets.reduce((sum, bucket) => sum + bucket.errors, 0),
    recent: buckets.slice(-SPARKLINE_BUCKETS),
    all: buckets,
    peakIndex,
  }
}

export function formatRate(perMinute: number): string {
  if (perMinute === 0) return "0"
  if (perMinute < 10) return perMinute.toFixed(1)
  return String(Math.round(perMinute))
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  )
}
