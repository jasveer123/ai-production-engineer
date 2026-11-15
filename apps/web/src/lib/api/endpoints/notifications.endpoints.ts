export const NOTIFICATIONS_ENDPOINTS = {
  CHANNELS: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/channels`,
  CHANNEL: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/channels/${id}`,
  TEST: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/channels/${id}/test`,
  DELIVERIES: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/deliveries`,
  INCIDENT: (workspaceId: string, incidentId: string) =>
    `/workspaces/${workspaceId}/notifications/incidents/${incidentId}`,
  PROVIDERS: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/providers`,
  CONTACTS: (workspaceId: string) => `/workspaces/${workspaceId}/notifications/contact-methods`,
  CONTACT: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/contact-methods/${id}`,
  CONTACT_TEST: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/notifications/contact-methods/${id}/test`,
} as const
