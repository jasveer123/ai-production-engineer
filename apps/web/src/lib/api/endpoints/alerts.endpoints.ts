export const ALERTS_ENDPOINTS = {
  ALERTS: (workspaceId: string) => `/workspaces/${workspaceId}/alerts`,
  SOURCES: (workspaceId: string) => `/workspaces/${workspaceId}/alert-sources`,
  ROTATE_SOURCE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/alert-sources/${id}/rotate-token`,
  SOURCE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/alert-sources/${id}`,
  HEARTBEAT: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/alert-sources/${id}/heartbeat`,
  RECEIPTS: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/alert-sources/${id}/events`,
  REPLAY: (workspaceId: string, id: string, receiptId: string) =>
    `/workspaces/${workspaceId}/alert-sources/${id}/events/${receiptId}/replay`,
  ROUTE_PREVIEW: (workspaceId: string) => `/workspaces/${workspaceId}/alert-routes/preview`,
  ROUTES: (workspaceId: string) => `/workspaces/${workspaceId}/alert-routes`,
  ROUTE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/alert-routes/${id}`,
  ROUTE_ORDER: (workspaceId: string) => `/workspaces/${workspaceId}/alert-routes/order`,
} as const

export const LOG_ALERTS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/log-alerts`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/log-alerts/${id}`,
  CHECK: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/log-alerts/${id}/check`,
} as const
