export const TELEMETRY_QUERY_KEYS = {
  live: (workspaceId: string, query: string, range: string) => [
    "telemetry",
    workspaceId,
    "live",
    query,
    range,
  ],
} as const
