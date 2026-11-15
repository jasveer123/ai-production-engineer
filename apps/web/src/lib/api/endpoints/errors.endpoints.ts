export const ERRORS_ENDPOINTS = {
  LIST: (workspaceId: string) => `/workspaces/${workspaceId}/errors`,
  RELEASES: (workspaceId: string) => `/workspaces/${workspaceId}/errors/releases`,
  SOURCE_MAPS: (workspaceId: string) => `/workspaces/${workspaceId}/source-maps`,
  SOURCE_MAP: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/source-maps/${id}`,
  APPS: (workspaceId: string) => `/workspaces/${workspaceId}/error-applications`,
  APP: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/error-applications/${id}`,
  ONE: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/errors/${id}`,
} as const
