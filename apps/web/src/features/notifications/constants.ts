export const NOTIFICATION_POLL_MS = 15_000

export const CHANNEL_KINDS = [
  { value: "slack", label: "Slack" },
  { value: "webhook", label: "Webhook" },
] as const

export const EVENTS = [
  { value: "incident.detected", label: "A new incident is detected" },
  { value: "review.requested", label: "A fix is waiting for your review" },
  { value: "incident.needs_attention", label: "An incident needs attention" },
  { value: "incident.resolved", label: "An incident is resolved" },
  { value: "verification.inconclusive", label: "Recovery could not be verified" },
] as const

export const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENTS.map((item) => [item.value, item.label])
)

export const MIN_SEVERITIES = ["low", "medium", "high", "critical"] as const
