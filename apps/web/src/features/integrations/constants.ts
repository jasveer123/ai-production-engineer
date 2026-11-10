export const INTEGRATION_GROUP = {
  COLLECT: "collect",
  CODE: "code",
} as const

export type IntegrationGroup = (typeof INTEGRATION_GROUP)[keyof typeof INTEGRATION_GROUP]

export const INTEGRATION_GROUP_LABEL: Record<IntegrationGroup, string> = {
  collect: "Collect it for me",
  code: "Send from my code",
}

export const INTEGRATION_GROUP_BLURB: Record<IntegrationGroup, string> = {
  collect: "Run one agent and it ships your logs. No code changes.",
  code: "Add a small package to your app.",
}

export const INTEGRATION_ID = {
  OPENTELEMETRY: "opentelemetry",
  DOCKER: "docker",
  KUBERNETES: "kubernetes",
  VECTOR: "vector",
  FLUENT_BIT: "fluent-bit",
  JAVASCRIPT: "javascript",
  PYTHON: "python",
} as const

export type IntegrationId = (typeof INTEGRATION_ID)[keyof typeof INTEGRATION_ID]

export const COLLECTOR = {
  NAME: "Pramaan collector",
  CONTAINER: "pramaan-collector",
  IMAGE: "pramaan/collector:0.1.0",
  CHART_NAME: "pramaan-collector",
  INTEGRATIONS: ["docker", "kubernetes"],
  ANCHOR: { DOCKER: "docker", KUBERNETES: "kubernetes" },
} as const

export const POLL_INTERVAL_MS = {
  OVERVIEW: 5_000,
  LOGS: 4_000,
  USAGE: 10_000,
  WORK: 15_000,
} as const

export const USAGE_WINDOW_MS = 60 * 60 * 1000

export const SPARKLINE_BUCKETS = 30

export const RECENT_BUCKETS_FOR_RATE = 5

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  detected: "Detected",
  investigating: "Investigating",
  fix_proposed: "Fix proposed",
  validation: "Checking the fix",
  awaiting_review: "Waiting for you",
  monitoring: "Watching production",
  needs_attention: "Needs attention",
  validation_failed: "Fix did not pass",
  verification_inconclusive: "Unclear result",
}

export const AWAITING_REVIEW_STATUS = "awaiting_review"

export const CHECKS_LABEL: Record<string, string> = {
  passing: "Passing",
  failing: "Failing",
  pending: "Running",
  none: "None",
}

export const SNIPPET_DEFAULTS = {
  SERVICE: "my-app",
  ENVIRONMENT: "production",
  TOKEN_PLACEHOLDER: "YOUR_TOKEN",
  WEB_URL_PLACEHOLDER: "https://YOUR_PRAMAAN_URL",
  INGEST_URL_PLACEHOLDER: "https://YOUR_INGEST_URL",
} as const

export const LOCAL_HOSTS = ["localhost", "127.0.0.1"]

export const CONTAINER_HOST = "host.docker.internal"

export const RECENT_LOGS_LIMIT = 8

export const TEST_LOG = {
  SERVICE: "pramaan-test",
  ENVIRONMENT: "test",
  LEVEL: "info",
  MESSAGE: "Test log sent from the Pramaan integrations page",
} as const

export const TOKEN_NAME_DEFAULT = "My first token"

export const STATE_LABEL = {
  receiving: "Receiving",
  silent: "Silent",
  not_set_up: "Not set up",
} as const
