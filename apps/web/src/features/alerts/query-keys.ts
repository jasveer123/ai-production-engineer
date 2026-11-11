export const ALERT_QUERY_KEYS = {
  all: (workspaceId: string) => ["alerts", workspaceId],
  feed: (workspaceId: string, status: string) => ["alerts", workspaceId, "feed", status],
  sources: (workspaceId: string) => ["alerts", workspaceId, "sources"],
  routes: (workspaceId: string) => ["alerts", workspaceId, "routes"],
} as const
