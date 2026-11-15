export const ESCALATION_POLL_MS = 15_000

export const SEVERITIES = ["low", "medium", "high", "critical"] as const

export const RUN_STATE_LABEL: Record<string, string> = {
  running: "Notifying",
  acknowledged: "Acknowledged",
  completed: "Nobody answered yet",
  cancelled: "Closed",
}

export const SOURCE_LABEL: Record<string, string> = {
  integration: "chosen by the alert source",
  default: "workspace default",
  builtin: "built-in fallback",
  legacy: "older run",
}

export const PERSON_CHANNELS = [
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "call", label: "Call" },
  { value: "push", label: "Push" },
] as const

export const REPEAT_OPTIONS = [0, 1, 2, 3, 5] as const

export const ESCALATE_AFTER = [
  { value: null, label: "Do nothing" },
  { value: 0, label: "Immediately" },
  { value: 3, label: "Within 3 minutes" },
  { value: 5, label: "Within 5 minutes" },
  { value: 10, label: "Within 10 minutes" },
] as const

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export const CONDITION_KEYS = ["service", "environment", "source"] as const
