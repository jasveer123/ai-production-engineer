export const METRICS_POLL_MS = 30_000

export const AGGS = [
  { value: "avg", label: "Average" },
  { value: "max", label: "Max" },
  { value: "min", label: "Min" },
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "rate", label: "Rate per second" },
  { value: "increase", label: "Increase" },
  { value: "p50", label: "p50" },
  { value: "p90", label: "p90" },
  { value: "p95", label: "p95" },
  { value: "p99", label: "p99" },
] as const

export const CHARTS = [
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "bar", label: "Bar" },
  { value: "stat", label: "Single stat" },
  { value: "table", label: "Table" },
] as const

export const WINDOWS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 10080, label: "7 days" },
] as const

export const ALERT_TYPES = [
  { value: "threshold", label: "Threshold", help: "Value crosses a fixed line." },
  {
    value: "relative",
    label: "Relative change",
    help: "Percent change against the previous window.",
  },
  {
    value: "anomaly",
    label: "Anomaly",
    help: "Standard deviations from the last 24 windows. Needs 12 windows of history first.",
  },
] as const

export const MISSING_DATA = [
  { value: "keep", label: "Keep the current state" },
  { value: "alert", label: "Treat as alerting" },
  { value: "ok", label: "Treat as OK" },
] as const

export const SEVERITIES = ["low", "medium", "high", "critical"] as const

export const ALERT_STATE_LABEL = {
  ok: "OK",
  pending: "Confirming",
  firing: "Firing",
  recovering: "Recovering",
  no_data: "No data",
  error: "Query error",
} as const
