export const ASSISTANT_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/assistant/conversations`,
  ONE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/assistant/conversations/${id}`,
  MESSAGES: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/assistant/conversations/${id}/messages`,
} as const
