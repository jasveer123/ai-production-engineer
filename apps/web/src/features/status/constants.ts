export const STATUS_POLL_MS = 30_000

export const UPDATE_STATES = ["investigating", "identified", "monitoring", "resolved"] as const

export const OVERALL_LABEL: Record<string, string> = {
  operational: "All systems operational",
  degraded: "Some systems are having problems",
  outage: "Major outage",
}

export const OVERALL_TONE: Record<string, string> = {
  operational: "bg-ok",
  degraded: "bg-warn",
  outage: "bg-danger",
}

export const COMPONENT_LABEL: Record<string, string> = {
  up: "Operational",
  down: "Down",
  pending: "Waiting for first check",
}
