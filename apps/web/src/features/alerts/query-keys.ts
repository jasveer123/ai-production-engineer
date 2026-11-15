export const ALERT_QUERY_KEYS = {
  all: (workspaceId: string) => ["alerts", workspaceId],
  feed: (workspaceId: string, status: string) => ["alerts", workspaceId, "feed", status],
  sources: (workspaceId: string) => ["alerts", workspaceId, "sources"],
  routes: (workspaceId: string) => ["alerts", workspaceId, "routes"],
  heartbeat: (workspaceId: string, id: string) => ["alerts", workspaceId, "heartbeat", id],
  receipts: (workspaceId: string, id: string) => ["alerts", workspaceId, "receipts", id],
  sourceAlerts: (workspaceId: string, id: string) => ["alerts", workspaceId, "source-alerts", id],
} as const
