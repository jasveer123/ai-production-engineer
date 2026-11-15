export const DEFAULT_RANGE = "1h"

export const EXPLORE_RANGES = [
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "6h", label: "6 hours" },
  { id: "24h", label: "24 hours" },
  { id: "3d", label: "3 days" },
  { id: "7d", label: "7 days" },
  { id: "14d", label: "14 days" },
] as const

export const LEVEL_ORDER = ["fatal", "error", "warn", "info", "debug", "trace"] as const

export const LEVEL_BAR: Record<string, string> = {
  fatal: "bg-danger",
  error: "bg-danger/70",
  warn: "bg-warn",
  info: "bg-brand/60",
  debug: "bg-line-strong",
  trace: "bg-line",
}

export const EXPLORE_HINT =
  'level:error service:checkout "timeout" status>=500 -path:/health user.id:* url~/api'

export const TRACE_HINT = "service:checkout operation~GET status:error duration>=250 http.route:*"

export const SPAN_ERROR = 2

export const FACET_LABEL: Record<string, string> = {
  level: "Level",
  service: "Service",
  environment: "Environment",
  host: "Host",
}
