export const ALERT_POLL_MS = 10_000

export const WEBHOOK_KINDS = [
  "http",
  "alertmanager",
  "grafana",
  "sentry",
  "datadog",
  "betterstack",
  "cloudwatch",
  "elasticsearch",
] as const

export const SOURCE_KIND_LABEL: Record<string, string> = {
  http: "HTTP (JSON)",
  alertmanager: "Prometheus Alertmanager",
  grafana: "Grafana alerting",
  sentry: "Sentry",
  datadog: "Datadog",
  betterstack: "Better Stack",
  cloudwatch: "Amazon CloudWatch",
  elasticsearch: "Elasticsearch / Kibana",
  heartbeat: "Heartbeat",
}

export const CONDITION_FIELDS = ["title", "description", "severity", "status", "label."] as const

export const CONDITION_OPS = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "regex", label: "matches" },
  { value: "exists", label: "exists" },
  { value: "not_exists", label: "does not exist" },
] as const

export const VALUELESS_OPS: string[] = ["exists", "not_exists"]

export const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const

export const ALERT_STATUS_FILTERS = ["all", "firing", "resolved"] as const
export type AlertStatusFilter = (typeof ALERT_STATUS_FILTERS)[number]

export const TIME_UNITS = [
  { value: 1, label: "seconds" },
  { value: 60, label: "minutes" },
  { value: 3600, label: "hours" },
  { value: 86400, label: "days" },
] as const

export const HEARTBEAT_STATE_VARIANT = {
  up: "success",
  late: "warning",
  down: "destructive",
  pending: "default",
  paused: "warning",
} as const

export const HEARTBEAT_STATE_LABEL: Record<string, string> = {
  up: "Up",
  late: "Late",
  down: "Down",
  pending: "Never received",
  paused: "Paused",
}

export const RECEIPT_VARIANT = {
  processed: "success",
  pending: "default",
  rejected: "destructive",
} as const

export const SELECT_CLASS =
  "h-10 w-full border border-line-strong bg-panel-2 px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/40"

export const LOG_LEVEL_OPTIONS = ["warn", "error", "fatal", "info", "debug"] as const
export const LOG_ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const
