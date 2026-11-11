export const NOTIFICATION_POLL_MS = 15_000

export const CHANNEL_KINDS = [
  { value: "slack", label: "Slack" },
  { value: "webhook", label: "Webhook" },
  { value: "sms", label: "SMS" },
  { value: "phone", label: "Phone call" },
  { value: "push", label: "Phone push (ntfy)" },
] as const

export const TARGET_COPY: Record<string, { label: string; help: string; placeholder: string }> = {
  slack: {
    label: "Slack incoming webhook URL",
    help: "It starts with https://hooks.slack.com/services/",
    placeholder: "https://hooks.slack.com/services/…",
  },
  webhook: {
    label: "Webhook URL",
    help: "Pramaan sends a signed JSON POST.",
    placeholder: "https://example.com/hook",
  },
  sms: {
    label: "Phone number",
    help: "International format, like +14155550123. Needs Twilio set up on this deployment.",
    placeholder: "+14155550123",
  },
  phone: {
    label: "Phone number to call",
    help: "A voice call reads the alert out. Needs Twilio set up on this deployment.",
    placeholder: "+14155550123",
  },
  push: {
    label: "ntfy topic URL",
    help: "Install the free ntfy app, subscribe to a topic, and paste its URL.",
    placeholder: "https://ntfy.sh/my-team-alerts",
  },
}

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
