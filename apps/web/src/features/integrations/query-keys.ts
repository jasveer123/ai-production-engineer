export const INTEGRATIONS_QUERY_KEYS = {
  overview: (workspaceId: string) => ["ingest", workspaceId, "overview"],
  logs: (workspaceId: string, query: string) => ["ingest", workspaceId, "logs", query],
  usage: (workspaceId: string) => ["ingest", workspaceId, "usage"],
  incidents: (workspaceId: string) => ["work", workspaceId, "incidents"],
  pullRequests: (workspaceId: string) => ["work", workspaceId, "pull-requests"],
} as const
