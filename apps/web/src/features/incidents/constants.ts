export const INCIDENT_POLL_MS = 8_000
export const DETAIL_POLL_MS = 5_000
export const LIST_LIMIT = 100

export const SEVERITIES = ["critical", "high", "medium", "low"] as const
export type SeverityValue = (typeof SEVERITIES)[number]

export const SEVERITY_VARIANT = {
  critical: "destructive",
  high: "destructive",
  medium: "warning",
  low: "default",
} as const

export const STATUS_LABEL: Record<string, string> = {
  detected: "Detected",
  investigating: "Investigating",
  fix_proposed: "Fix drafted",
  validation: "Checking the fix",
  awaiting_review: "Waiting for you",
  monitoring: "Watching production",
  resolved: "Resolved",
  needs_attention: "Needs attention",
  closed_without_fix: "Closed without a fix",
  validation_failed: "Fix did not pass",
  verification_inconclusive: "Unclear result",
}

export const STATUS_VARIANT: Record<
  string,
  "default" | "brand" | "ai" | "success" | "warning" | "destructive" | "info"
> = {
  detected: "warning",
  investigating: "ai",
  fix_proposed: "brand",
  validation: "ai",
  awaiting_review: "warning",
  monitoring: "info",
  resolved: "success",
  needs_attention: "destructive",
  closed_without_fix: "default",
  validation_failed: "destructive",
  verification_inconclusive: "warning",
}

export const CLOSED_STATUSES: string[] = ["resolved", "closed_without_fix"]

export const FLOW_STEPS = [
  { status: "detected", label: "Detected" },
  { status: "investigating", label: "Investigating" },
  { status: "fix_proposed", label: "Fix drafted" },
  { status: "validation", label: "Checking" },
  { status: "awaiting_review", label: "Your review" },
  { status: "monitoring", label: "Watching" },
  { status: "resolved", label: "Resolved" },
] as const

export const CONFIDENCE_VARIANT = { high: "success", medium: "warning", low: "default" } as const

export const PR_STATUS_VARIANT = { open: "info", merged: "success", closed: "default" } as const
export const CHECKS_VARIANT = {
  passing: "success",
  failing: "destructive",
  pending: "warning",
  none: "default",
} as const
export const CHECKS_LABEL: Record<string, string> = {
  passing: "Checks passing",
  failing: "Checks failing",
  pending: "Checks running",
  none: "No checks",
}

export const RUN_STATUS_VARIANT = {
  passed: "success",
  failed: "destructive",
  error: "destructive",
  skipped: "default",
} as const

export const RUN_KIND_LABEL: Record<string, string> = {
  baseline: "Baseline",
  reproduction: "Reproduces the bug",
  regression: "Regression",
  full_suite: "Full test suite",
  policy: "Policy",
}

export const OUTCOME_LABEL: Record<string, string> = {
  recovered: "Recovered",
  not_recovered: "Not recovered",
  inconclusive: "Inconclusive",
}

export const VERDICTS = [
  { value: "correct", label: "Right" },
  { value: "partly", label: "Partly right" },
  { value: "wrong", label: "Wrong" },
] as const

export const RESPONSE_LABEL: Record<string, string> = {
  open: "Ongoing",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
}

export const RESPONSE_VARIANT = {
  open: "destructive",
  acknowledged: "warning",
  resolved: "success",
} as const

export const STATE_FILTERS = [
  { value: "unresolved", label: "Unresolved" },
  { value: "open", label: "Ongoing" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
] as const

export const ACTIVITY_LABEL: Record<string, string> = {
  incident_started: "Started",
  check_failed: "Check failed",
  alert: "Alert",
  error: "Error",
  deploy: "Deploy",
  notification: "Notified",
  acknowledged: "Acknowledged",
  unacknowledged: "Unacknowledged",
  escalated: "Escalated",
  comment: "Comment",
  status_change: "AI status",
  ai: "AI",
  updated: "Updated",
  resolved: "Resolved",
  reopened: "Reopened",
  post_mortem: "Post-mortem",
}

export const ACTIVITY_VARIANT: Record<
  string,
  "default" | "brand" | "ai" | "success" | "warning" | "destructive" | "info"
> = {
  check_failed: "destructive",
  error: "destructive",
  incident_started: "destructive",
  notification: "info",
  acknowledged: "warning",
  escalated: "warning",
  comment: "brand",
  ai: "ai",
  status_change: "ai",
  resolved: "success",
  post_mortem: "brand",
}
