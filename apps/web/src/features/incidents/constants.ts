export const INCIDENT_POLL_MS = 8_000
export const DETAIL_POLL_MS = 5_000
export const LIST_LIMIT = 100

export const STATUS_FILTERS = ["open", "closed", "all"] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  open: "Open",
  closed: "Closed",
  all: "All",
}

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

export const TRANSITIONS: Record<string, string[]> = {
  detected: ["investigating", "needs_attention", "closed_without_fix"],
  investigating: ["fix_proposed", "needs_attention", "closed_without_fix"],
  fix_proposed: ["validation", "needs_attention", "closed_without_fix"],
  validation: ["awaiting_review", "validation_failed"],
  validation_failed: ["fix_proposed", "needs_attention", "closed_without_fix"],
  awaiting_review: ["monitoring", "fix_proposed", "closed_without_fix"],
  monitoring: ["resolved", "needs_attention", "verification_inconclusive"],
  verification_inconclusive: ["monitoring", "resolved", "needs_attention"],
  needs_attention: ["investigating", "resolved", "closed_without_fix"],
  resolved: ["needs_attention"],
  closed_without_fix: ["needs_attention"],
}

export const MANUAL_TRANSITION_LABEL: Record<string, string> = {
  resolved: "Mark resolved",
  closed_without_fix: "Close without a fix",
  needs_attention: "Needs attention",
}

export const TIMELINE_KIND_LABEL: Record<string, string> = {
  error: "Error",
  created: "Created",
  status_change: "Status",
  investigation: "Investigation",
  fix: "Fix",
  verification: "Verification",
  alert: "Alert",
  deploy: "Deploy",
}

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
