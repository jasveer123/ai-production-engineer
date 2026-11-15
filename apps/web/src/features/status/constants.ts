export const STATUS_POLL_MS = 30_000

export const UPDATE_STATES = ["investigating", "identified", "monitoring", "resolved"] as const

export const IMPACTS = ["degraded", "downtime", "resolved"] as const

export const MANUAL_STATES = ["operational", "degraded", "downtime", "maintenance"] as const

export const THEMES = ["system", "light", "dark"] as const

export const HEADER_LAYOUTS = [
  { value: "logo_and_name", label: "Logo and name" },
  { value: "logo_only", label: "Logo only" },
  { value: "name_only", label: "Name only" },
] as const

export const OVERALL_LABEL: Record<string, string> = {
  operational: "All systems operational",
  degraded: "Some systems are having problems",
  outage: "Major outage",
  maintenance: "Scheduled maintenance in progress",
  unknown: "Status is not known yet",
}

export const OVERALL_TONE: Record<string, string> = {
  operational: "bg-ok",
  degraded: "bg-warn",
  outage: "bg-danger",
  maintenance: "bg-info",
  unknown: "bg-line-strong",
}

export const STATE_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  downtime: "Downtime",
  maintenance: "Maintenance",
  unknown: "Unknown",
  resolved: "Resolved",
}

export const STATE_TONE: Record<string, string> = {
  operational: "text-ok",
  degraded: "text-warn",
  downtime: "text-danger",
  maintenance: "text-info",
  unknown: "text-muted-foreground",
  resolved: "text-ok",
}

export const PHASE_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  completed: "Completed",
}

export const SUBSCRIBER_TONE: Record<string, "success" | "warning" | "default"> = {
  confirmed: "success",
  pending: "warning",
  unsubscribed: "default",
}
