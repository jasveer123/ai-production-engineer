export const METRICS_ENDPOINTS = {
  NAMES: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/names`,
  LABELS: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/labels`,
  SERIES: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/series`,
  DASHBOARDS: (workspaceId: string) => `/workspaces/${workspaceId}/metrics/dashboards`,
  DASHBOARD: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/metrics/dashboards/${id}`,
} as const
