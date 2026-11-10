export const INGEST_ENDPOINTS = {
  OVERVIEW: (workspaceId: string) => `/workspaces/${workspaceId}/ingest`,
  CREATE_TOKEN: (workspaceId: string) => `/workspaces/${workspaceId}/ingest/tokens`,
  ROTATE_TOKEN: (workspaceId: string, tokenId: string) =>
    `/workspaces/${workspaceId}/ingest/tokens/${tokenId}/rotate`,
  REVOKE_TOKEN: (workspaceId: string, tokenId: string) =>
    `/workspaces/${workspaceId}/ingest/tokens/${tokenId}`,
  LOGS: (workspaceId: string) => `/workspaces/${workspaceId}/logs`,
  SEND_LOGS: "/v1/logs",
} as const
