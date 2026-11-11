export const STATUS_ENDPOINTS = {
  PAGES: (workspaceId: string) => `/workspaces/${workspaceId}/status-pages`,
  PAGE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/status-pages/${id}`,
  UPDATES: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/status-pages/${id}/updates`,
  UPDATE: (workspaceId: string, id: string, updateId: string) =>
    `/workspaces/${workspaceId}/status-pages/${id}/updates/${updateId}`,
  VERIFY: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/status-pages/${id}/verify-domain`,
  SUBSCRIBE: (slug: string) => `/public/status/${slug}/subscribe`,
  BY_DOMAIN: (host: string) => `/public/status/domain/${host}`,
  CONFIRM: "/public/status/subscriptions/confirm",
  UNSUBSCRIBE: "/public/status/subscriptions/unsubscribe",
  PUBLIC: (slug: string) => `/public/status/${slug}`,
} as const
