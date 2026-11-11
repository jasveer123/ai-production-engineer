export const ERRORS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/errors`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/errors/${id}`,
} as const
