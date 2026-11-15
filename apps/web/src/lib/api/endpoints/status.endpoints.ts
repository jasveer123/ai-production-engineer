const page = (workspaceId: string, id: string) => `/workspaces/${workspaceId}/status-pages/${id}`

export const STATUS_ENDPOINTS = {
  PAGES: (workspaceId: string) => `/workspaces/${workspaceId}/status-pages`,
  PAGE: page,
  VERIFY: (workspaceId: string, id: string) => `${page(workspaceId, id)}/verify-domain`,
  STRUCTURE: (workspaceId: string, id: string) => `${page(workspaceId, id)}/structure`,
  REPORTS: (workspaceId: string, id: string) => `${page(workspaceId, id)}/reports`,
  REPORT: (workspaceId: string, id: string, reportId: string) =>
    `${page(workspaceId, id)}/reports/${reportId}`,
  REPORT_UPDATES: (workspaceId: string, id: string, reportId: string) =>
    `${page(workspaceId, id)}/reports/${reportId}/updates`,
  REPORT_UPDATE: (workspaceId: string, id: string, reportId: string, updateId: string) =>
    `${page(workspaceId, id)}/reports/${reportId}/updates/${updateId}`,
  MAINTENANCES: (workspaceId: string, id: string) => `${page(workspaceId, id)}/maintenance`,
  MAINTENANCE: (workspaceId: string, id: string, maintenanceId: string) =>
    `${page(workspaceId, id)}/maintenance/${maintenanceId}`,
  SUBSCRIBERS: (workspaceId: string, id: string) => `${page(workspaceId, id)}/subscribers`,
  SUBSCRIBERS_CSV: (workspaceId: string, id: string) => `${page(workspaceId, id)}/subscribers.csv`,
  SUBSCRIBER: (workspaceId: string, id: string, subscriberId: string) =>
    `${page(workspaceId, id)}/subscribers/${subscriberId}`,
  NOTIFICATIONS: (workspaceId: string, id: string) => `${page(workspaceId, id)}/notifications`,
  SUBSCRIBE: (slug: string) => `/public/status/${slug}/subscribe`,
  ACCESS: (slug: string) => `/public/status/${slug}/access`,
  HISTORY: (slug: string) => `/public/status/${slug}/history`,
  FEED_ATOM: (slug: string) => `/public/status/${slug}/feed.atom`,
  FEED_RSS: (slug: string) => `/public/status/${slug}/feed.rss`,
  SUMMARY: (slug: string) => `/public/status/${slug}/summary.json`,
  BY_DOMAIN: (host: string) => `/public/status/domain/${host}`,
  CONFIRM: "/public/status/subscriptions/confirm",
  UNSUBSCRIBE: "/public/status/subscriptions/unsubscribe",
  PUBLIC: (slug: string) => `/public/status/${slug}`,
} as const
