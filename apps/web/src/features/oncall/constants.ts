export const ONCALL_POLL_MS = 30_000

export const ROTATIONS = [
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Daily" },
  { hours: 168, label: "Weekly" },
  { hours: 336, label: "Every 2 weeks" },
] as const

export const PERSON_COLORS = [
  "bg-brand",
  "bg-ai",
  "bg-ok",
  "bg-info",
  "bg-warn",
  "bg-danger",
] as const

export const SHOWN_SHIFTS = 6
