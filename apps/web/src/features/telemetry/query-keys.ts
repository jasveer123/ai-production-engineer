export const TELEMETRY_QUERY_KEYS = {
  live: (workspaceId: string, query: string) => ["telemetry", workspaceId, "live", query],
} as const
