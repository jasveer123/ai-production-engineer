export const INCIDENTS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/incidents`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/incidents/${id}`,
  TIMELINE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/timeline`,
  TRANSITION: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/transitions`,
  INVESTIGATION: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/investigation`,
  EVIDENCE: (workspaceId: string, id: string, evidenceId: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/evidence/${evidenceId}`,
  ACTION: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/incidents/${id}/actions`,
  FEEDBACK: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/investigation/feedback`,
  FIXES: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/incidents/${id}/fixes`,
  FIX_ACTION: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/fixes/actions`,
  VERIFICATION: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/verification`,
  PULL_REQUESTS: (workspaceId: string) => `/workspaces/${workspaceId}/pull-requests`,
  SYNC_PULL_REQUEST: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/pull-requests/${id}/sync`,
} as const
