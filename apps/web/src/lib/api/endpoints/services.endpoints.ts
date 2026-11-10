export const SERVICES_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/services`,
  IMPACT: (workspaceId: string) => `/workspaces/${workspaceId}/business/impact`,
  VALUE: (workspaceId: string, serviceId: string) =>
    `/workspaces/${workspaceId}/business/services/${serviceId}/value`,
} as const
