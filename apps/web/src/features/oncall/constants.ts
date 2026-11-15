export const ONCALL_POLL_MS = 30_000

export const ROTATION_UNITS = [
  { days: 1, label: "Daily" },
  { days: 7, label: "Weekly" },
  { days: 14, label: "Every 2 weeks" },
] as const

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export const COVERAGE_DAYS = 28

export const SELECT_CLASS =
  "h-10 w-full border border-line-strong bg-panel-2 px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/40"

export const PERSON_COLORS = [
  "bg-brand",
  "bg-ai",
  "bg-ok",
  "bg-info",
  "bg-warn",
  "bg-danger",
] as const

export const SHOWN_SHIFTS = 6
