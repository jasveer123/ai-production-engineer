export const ESCALATION_ENDPOINTS = {
  POLICIES: (workspaceId: string) => `/workspaces/${workspaceId}/escalation/policies`,
  POLICY: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/escalation/policies/${id}`,
  PREVIEW: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/escalation/policies/${id}/preview`,
  SIMPLE: (workspaceId: string) => `/workspaces/${workspaceId}/escalation/policies/simple`,
  RUNS: (workspaceId: string) => `/workspaces/${workspaceId}/escalation/runs`,
} as const
