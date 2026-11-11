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

export const HEARTBEAT_INTERVALS = [
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
] as const

export const HEARTBEAT_GRACES = [
  { seconds: 60, label: "1 minute" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 900, label: "15 minutes" },
] as const

export const HEARTBEAT_STATE_VARIANT = {
  up: "success",
  down: "destructive",
  pending: "default",
} as const

export const HEARTBEAT_STATE_LABEL: Record<string, string> = {
  up: "Up",
  down: "Down",
  pending: "Waiting for first ping",
}
