export const SERVICES_QUERY_KEYS = {
  summary: (workspaceId: string, hours: number) => ["services", workspaceId, "summary", hours],
  registered: (workspaceId: string) => ["services", workspaceId, "registered"],
  impact: (workspaceId: string, days: number) => ["services", workspaceId, "impact", days],
  map: (workspaceId: string, range: string) => ["services", workspaceId, "map", range],
} as const
