export const INCIDENT_QUERY_KEYS = {
  all: (workspaceId: string) => ["incidents", workspaceId],
  list: (workspaceId: string, status: string, severity: string) => [
    "incidents",
    workspaceId,
    "list",
    status,
    severity,
  ],
  one: (workspaceId: string, id: string) => ["incidents", workspaceId, "one", id],
  timeline: (workspaceId: string, id: string) => ["incidents", workspaceId, "timeline", id],
  investigation: (workspaceId: string, id: string) => [
    "incidents",
    workspaceId,
    "investigation",
    id,
  ],
  evidence: (workspaceId: string, id: string, evidenceId: string) => [
    "incidents",
    workspaceId,
    "evidence",
    id,
    evidenceId,
  ],
  fixes: (workspaceId: string, id: string) => ["incidents", workspaceId, "fixes", id],
  verification: (workspaceId: string, id: string) => ["incidents", workspaceId, "verification", id],
  pullRequests: (workspaceId: string) => ["incidents", workspaceId, "pull-requests"],
} as const
