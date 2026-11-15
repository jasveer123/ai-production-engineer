export const ERRORS_POLL_MS = 20_000

export const STATUS_FILTERS = [
  { value: "unresolved", label: "Unresolved" },
  { value: "regressed", label: "Regressed" },
  { value: "snoozed", label: "Snoozed" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
  { value: "all", label: "All" },
] as const

export const STATUS_VARIANT: Record<string, "destructive" | "success" | "default" | "warning"> = {
  unresolved: "destructive",
  regressed: "destructive",
  resolved: "success",
  ignored: "default",
  snoozed: "warning",
}

export const PLATFORMS = [
  { value: "javascript", label: "Browser JavaScript" },
  { value: "node", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "other", label: "Other Sentry SDK" },
] as const

export const SNOOZE_OPTIONS = [
  { label: "1 hour", body: { snoozeMinutes: 60 } },
  { label: "24 hours", body: { snoozeMinutes: 1440 } },
  { label: "7 days", body: { snoozeMinutes: 10080 } },
  { label: "Next 10 events", body: { snoozeOccurrences: 10 } },
  { label: "Next 100 events", body: { snoozeOccurrences: 100 } },
] as const
