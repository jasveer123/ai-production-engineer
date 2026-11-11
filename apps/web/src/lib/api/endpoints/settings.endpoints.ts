export const SETTINGS_ENDPOINTS = {
  WORKSPACE: (workspaceId: string) => `/workspaces/${workspaceId}`,
  MEMBERS: (workspaceId: string) => `/workspaces/${workspaceId}/members`,
  MEMBER: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/members/${id}`,
  INVITATIONS: (workspaceId: string) => `/workspaces/${workspaceId}/invitations`,
  INVITATION: (workspaceId: string, id: string) => `/workspaces/${workspaceId}/invitations/${id}`,
  APPROVAL: (workspaceId: string) => `/workspaces/${workspaceId}/settings/approval-policy`,
  USAGE: (workspaceId: string) => `/workspaces/${workspaceId}/usage`,
  LIMITS: (workspaceId: string) => `/workspaces/${workspaceId}/usage/limits`,
  AUDIT: (workspaceId: string) => `/workspaces/${workspaceId}/audit-events`,
} as const
