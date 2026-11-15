export const REPORTING_ENDPOINTS = {
  REPORT: (workspaceId: string, report: string) => `/workspaces/${workspaceId}/reporting/${report}`,
} as const
