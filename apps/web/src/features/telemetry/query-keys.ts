export const TELEMETRY_QUERY_KEYS = {
  logs: (workspaceId: string, params: object) => ["telemetry", workspaceId, "logs", params],
  facets: (workspaceId: string, params: object, field?: string) => [
    "telemetry",
    workspaceId,
    "facets",
    params,
    field,
  ],
  context: (workspaceId: string, logId: number) => ["telemetry", workspaceId, "context", logId],
  traces: (workspaceId: string, params: object) => ["telemetry", workspaceId, "traces", params],
  operations: (workspaceId: string, params: object) => [
    "telemetry",
    workspaceId,
    "operations",
    params,
  ],
  trace: (workspaceId: string, traceId: string) => ["telemetry", workspaceId, "trace", traceId],
  saved: (workspaceId: string, signal: string) => ["telemetry", workspaceId, "saved", signal],
} as const
