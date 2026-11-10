export const LIVE_POLL_MS = 2_000
export const LIVE_LIMIT = 150

export const LOG_LEVEL_FILTERS = ["error", "warn", "info", "debug"] as const

export const TIME_RANGES = [
  { id: "15m", label: "15 min", ms: 15 * 60 * 1000 },
  { id: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { id: "6h", label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { id: "24h", label: "24 hours", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
] as const

export type TimeRangeId = (typeof TIME_RANGES)[number]["id"]

export const DEFAULT_RANGE: TimeRangeId = "1h"

export const QUERY_HINT =
  'Try: timeout   level:error   service:shop-api   "payment failed"   trace:abc'
