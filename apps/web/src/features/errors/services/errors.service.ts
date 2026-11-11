import { z } from "zod"
import { ERRORS_ENDPOINTS, http } from "@/lib/api"
import {
  errorDetailSchema,
  errorGroupSchema,
  releaseSchema,
  sourceMapSchema,
  type ErrorDetail,
  type ErrorGroup,
  type ErrorRelease,
  type SourceMap,
} from "../schemas"

export const errorsService = {
  list: (workspaceId: string, query: { status?: string; q?: string; assignee?: string }) =>
    http.get<ErrorGroup[]>(ERRORS_ENDPOINTS.LIST(workspaceId), {
      query,
      schema: z.array(errorGroupSchema),
    }),

  get: (workspaceId: string, id: string) =>
    http.get<ErrorDetail>(ERRORS_ENDPOINTS.ONE(workspaceId, id), { schema: errorDetailSchema }),

  update: (
    workspaceId: string,
    id: string,
    body: { status?: string; assigneeId?: string | null }
  ) =>
    http.patch<ErrorGroup>(ERRORS_ENDPOINTS.ONE(workspaceId, id), body, {
      schema: errorGroupSchema,
    }),

  releases: (workspaceId: string) =>
    http.get<ErrorRelease[]>(ERRORS_ENDPOINTS.RELEASES(workspaceId), {
      schema: z.array(releaseSchema),
    }),

  sourceMaps: (workspaceId: string) =>
    http.get<SourceMap[]>(ERRORS_ENDPOINTS.SOURCE_MAPS(workspaceId), {
      schema: z.array(sourceMapSchema),
    }),

  uploadSourceMap: (workspaceId: string, body: { release: string; file: string; map: string }) =>
    http.post<SourceMap>(ERRORS_ENDPOINTS.SOURCE_MAPS(workspaceId), body, {
      schema: sourceMapSchema,
    }),

  removeSourceMap: (workspaceId: string, id: string) =>
    http.delete<void>(ERRORS_ENDPOINTS.SOURCE_MAP(workspaceId, id)),
}
