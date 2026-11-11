export const ERRORS_POLL_MS = 20_000

export const STATUS_FILTERS = [
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
  { value: "all", label: "All" },
] as const

export const STATUS_VARIANT: Record<string, "destructive" | "success" | "default"> = {
  unresolved: "destructive",
  resolved: "success",
  ignored: "default",
}
