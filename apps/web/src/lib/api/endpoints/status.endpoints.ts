export const STATUS_ENDPOINTS = {
  PAGES: (workspaceId: string) => `/workspaces/${workspaceId}/status-pages`,
  PAGE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/status-pages/${id}`,
  UPDATES: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/status-pages/${id}/updates`,
  UPDATE: (workspaceId: string, id: string, updateId: string) =>
    `/workspaces/${workspaceId}/status-pages/${id}/updates/${updateId}`,
  PUBLIC: (slug: string) => `/public/status/${slug}`,
} as const
