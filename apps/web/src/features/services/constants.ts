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
