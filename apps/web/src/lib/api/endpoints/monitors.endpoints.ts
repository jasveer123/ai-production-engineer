export const MONITORS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/monitors`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/monitors/${id}`,
  CHECK: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/monitors/${id}/check`,
  BULK: (workspaceId: string) => `/workspaces/${workspaceId}/monitors/bulk`,
  TEST_ALERT: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/monitors/${id}/test-alert`,
} as const
