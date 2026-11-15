export const ROLES = ["owner", "admin", "engineer", "viewer"] as const

export const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including billing limits and approval rules",
  admin: "Manage team, integrations and settings",
  engineer: "Investigate incidents and approve fixes",
  viewer: "Read only",
}

export const PR_ROLES = ["owner", "admin", "engineer"] as const

export const TOKEN_EXPIRIES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
] as const

export const TOKEN_SCOPES = [
  { value: "read", label: "Read" },
  { value: "write", label: "Write" },
  { value: "ingest", label: "Ingest only" },
] as const

export const TOKEN_AREAS = [
  { value: "monitors", label: "Monitors" },
  { value: "alerts", label: "Alerts and heartbeats" },
  { value: "incidents", label: "Incidents" },
  { value: "oncall", label: "On-call" },
  { value: "status-pages", label: "Status pages" },
] as const

export const HEALTH_VARIANT = { ok: "success", degraded: "warning", down: "destructive" } as const
