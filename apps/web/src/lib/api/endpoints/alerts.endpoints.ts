export const ALERTS_ENDPOINTS = {
  ALERTS: (workspaceId: string) => `/workspaces/${workspaceId}/alerts`,
  SOURCES: (workspaceId: string) => `/workspaces/${workspaceId}/alert-sources`,
  ROTATE_SOURCE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/alert-sources/${id}/rotate-token`,
  SOURCE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/alert-sources/${id}`,
  ROUTES: (workspaceId: string) => `/workspaces/${workspaceId}/alert-routes`,
  ROUTE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/alert-routes/${id}`,
  ROUTE_ORDER: (workspaceId: string) => `/workspaces/${workspaceId}/alert-routes/order`,
} as const
