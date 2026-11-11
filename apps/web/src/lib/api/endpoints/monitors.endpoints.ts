export const MONITORS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/monitors`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/monitors/${id}`,
  CHECK: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/monitors/${id}/check`,
} as const
