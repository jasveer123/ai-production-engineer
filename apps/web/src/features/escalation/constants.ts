export const ESCALATION_POLL_MS = 15_000

export const SEVERITIES = ["low", "medium", "high", "critical"] as const

export const RUN_STATE_LABEL: Record<string, string> = {
  running: "Notifying",
  acknowledged: "Acknowledged",
  completed: "Nobody answered",
  cancelled: "Closed",
}
