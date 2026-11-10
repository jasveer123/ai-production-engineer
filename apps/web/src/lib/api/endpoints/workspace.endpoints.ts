export const WORKSPACE_ENDPOINTS = {
  INCIDENTS: (workspaceId: string) => `/workspaces/${workspaceId}/incidents`,
  PULL_REQUESTS: (workspaceId: string) => `/workspaces/${workspaceId}/pull-requests`,
} as const
