const base = (workspaceId: string) => `/workspaces/${workspaceId}/explore`

export const EXPLORE_ENDPOINTS = {
  LOGS: (workspaceId: string) => `${base(workspaceId)}/logs`,
  FACETS: (workspaceId: string) => `${base(workspaceId)}/logs/facets`,
  TAIL: (workspaceId: string) => `${base(workspaceId)}/logs/tail`,
  CONTEXT: (workspaceId: string, logId: number) => `${base(workspaceId)}/logs/${logId}/context`,
  TRACES: (workspaceId: string) => `${base(workspaceId)}/traces`,
  OPERATIONS: (workspaceId: string) => `${base(workspaceId)}/traces/operations`,
  TRACE: (workspaceId: string, traceId: string) =>
    `${base(workspaceId)}/traces/${encodeURIComponent(traceId)}`,
  SERVICE_MAP: (workspaceId: string) => `${base(workspaceId)}/service-map`,
  SAVED: (workspaceId: string) => `${base(workspaceId)}/saved-queries`,
  SAVED_ITEM: (workspaceId: string, id: string) => `${base(workspaceId)}/saved-queries/${id}`,
  SOURCES: (workspaceId: string) => `${base(workspaceId)}/sources`,
  SOURCE_PAUSE: (workspaceId: string, id: string) => `${base(workspaceId)}/sources/${id}/pause`,
  SOURCE_RESUME: (workspaceId: string, id: string) => `${base(workspaceId)}/sources/${id}/resume`,
} as const
