import { INGEST_ENDPOINTS, http } from "@/lib/api"
import {
  ingestOverviewSchema,
  ingestTokenWithSecretSchema,
  logSearchResultSchema,
  type CreateTokenRequest,
  type IngestOverview,
  type IngestTokenWithSecret,
  type LogSearchResult,
  type TestLogRequest,
} from "../schemas"
import { RECENT_LOGS_LIMIT, TEST_LOG, USAGE_WINDOW_MS } from "../constants"

const TOKEN_HEADER = "x-ape-token"

export const ingestService = {
  overview: (workspaceId: string) =>
    http.get<IngestOverview>(INGEST_ENDPOINTS.OVERVIEW(workspaceId), {
      schema: ingestOverviewSchema,
    }),

  createToken: (workspaceId: string, body: CreateTokenRequest) =>
    http.post<IngestTokenWithSecret>(INGEST_ENDPOINTS.CREATE_TOKEN(workspaceId), body, {
      schema: ingestTokenWithSecretSchema,
    }),

  rotateToken: (workspaceId: string, tokenId: string) =>
    http.post<IngestTokenWithSecret>(
      INGEST_ENDPOINTS.ROTATE_TOKEN(workspaceId, tokenId),
      undefined,
      {
        schema: ingestTokenWithSecretSchema,
      }
    ),

  revokeToken: (workspaceId: string, tokenId: string) =>
    http.delete<void>(INGEST_ENDPOINTS.REVOKE_TOKEN(workspaceId, tokenId)),

  recentLogs: (workspaceId: string, query: string) =>
    http.get<LogSearchResult>(INGEST_ENDPOINTS.LOGS(workspaceId), {
      query: { q: query, limit: RECENT_LOGS_LIMIT },
      schema: logSearchResultSchema,
    }),

  usage: (workspaceId: string) =>
    http.get<LogSearchResult>(INGEST_ENDPOINTS.LOGS(workspaceId), {
      query: { from: new Date(Date.now() - USAGE_WINDOW_MS).toISOString(), limit: 1 },
      schema: logSearchResultSchema,
    }),

  sendTestLog: ({ token }: TestLogRequest) =>
    http.post<unknown>(
      INGEST_ENDPOINTS.SEND_LOGS,
      { level: TEST_LOG.LEVEL, message: TEST_LOG.MESSAGE },
      {
        headers: { [TOKEN_HEADER]: token },
        query: { service: TEST_LOG.SERVICE, env: TEST_LOG.ENVIRONMENT },
        skipAuthRedirect: true,
        skipAuthRefresh: true,
      }
    ),
}
