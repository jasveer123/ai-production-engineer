export const SUMMARY_HOURS = 24
export const SUMMARY_REFRESH_MS = 15_000
export const QUIET_AFTER_MS = 15 * 60 * 1000
export const IMPACT_DAYS = 7
export const DEFAULT_CURRENCY = "USD"

export const STATUS_FILTERS = ["all", "receiving", "quiet", "problem"] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All",
  receiving: "Receiving",
  quiet: "Quiet",
  problem: "Has a problem",
}

export const WAY_LABEL: Record<string, string> = {
  agent: "Collector",
  package: "Package",
  otlp: "OpenTelemetry",
  http: "HTTP",
  drain: "Log drain",
  syslog: "Syslog",
}

export const MAP_RANGES = [
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 hour" },
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
] as const

export const MAP_NODE = { width: 180, height: 56, columnGap: 110, rowGap: 28, pad: 16 } as const
