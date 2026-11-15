export const ONCALL_ENDPOINTS = {
  SCHEDULES: (workspaceId: string) => `/workspaces/${workspaceId}/oncall/schedules`,
  SCHEDULE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/oncall/schedules/${id}`,
  OVERRIDES: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/oncall/schedules/${id}/overrides`,
  OVERRIDE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/oncall/overrides/${id}`,
  COVERAGE: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/oncall/schedules/${id}/coverage`,
  CALENDAR_LINK: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/oncall/schedules/${id}/calendar-link`,
  MEMBERS: (workspaceId: string) => `/workspaces/${workspaceId}/members`,
} as const
