export const NOTIFICATIONS_ENDPOINTS = {
  CHANNELS: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/channels`,
  CHANNEL: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/channels/${id}`,
  TEST: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/channels/${id}/test`,
  DELIVERIES: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/deliveries`,
} as const
