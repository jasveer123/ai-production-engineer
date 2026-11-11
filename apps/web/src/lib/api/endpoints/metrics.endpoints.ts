export const METRICS_ENDPOINTS = {
  NAMES: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/names`,
  SERIES: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/series`,
  DASHBOARDS: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/dashboards`,
  DASHBOARD: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/metrics/dashboards/${id}`,
} as const
