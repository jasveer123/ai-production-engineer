export const RUM_ENDPOINTS = {
  APPS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/apps`,
  APP: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/rum/apps/${id}`,
  VITALS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/vitals`,
  OVERVIEW: (workspaceId: string) => `/workspaces/${workspaceId}/rum/overview`,
  SESSIONS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/sessions`,
  SESSION: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/rum/sessions/${id}`,
  REPLAY: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/rum/sessions/${id}/replay`,
  USERS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/users`,
  EVENTS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/events`,
  FUNNELS: (workspaceId: string) => `/workspaces/${workspaceId}/rum/funnels`,
  FUNNEL: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/rum/funnels/${id}`,
  FUNNEL_RESULT: (workspaceId: string, id: string) =>
    `/workspaces/${workspaceId}/rum/funnels/${id}/result`,
} as const
