export const INCIDENTS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/incidents`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/incidents/${id}`,
  TIMELINE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/timeline`,
  ACKNOWLEDGE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/acknowledge`,
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
  RESPOND: (workspaceId: string, id: string, action: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/${action}`,
  ACTIVITY: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/activity`,
  CONTEXT: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/context`,
  COMMENTS: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/comments`,
  COMMENT: (workspaceId: string, id: string, commentId: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/comments/${commentId}`,
  POST_MORTEM: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/post-mortem`,
  METADATA: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/incidents/${id}/metadata`,
} as const
