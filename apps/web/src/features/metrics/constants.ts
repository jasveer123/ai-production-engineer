export const METRICS_POLL_MS = 30_000

export const AGGS = [
  { value: "avg", label: "Average" },
  { value: "max", label: "Max" },
  { value: "min", label: "Min" },
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "rate", label: "Rate per second" },
] as const

export const WINDOWS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 360, label: "6 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 10080, label: "7 days" },
] as const
