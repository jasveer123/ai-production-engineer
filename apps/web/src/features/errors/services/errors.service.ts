import { z } from "zod"
import { ERRORS_ENDPOINTS, http } from "@/lib/api"
import { errorDetailSchema, errorGroupSchema, type ErrorDetail, type ErrorGroup } from "../schemas"

export const errorsService = {
  list: (workspaceId: string, query: { status?: string; q?: string }) =>
    http.get<ErrorGroup[]>(ERRORS_ENDPOINTS.LIST(workspaceId), {
      query,
      schema: z.array(errorGroupSchema),
    }),

  get: (workspaceId: string, id: string) =>
    http.get<ErrorDetail>(ERRORS_ENDPOINTS.ONE(workspaceId, id), { schema: errorDetailSchema }),

  setStatus: (workspaceId: string, id: string, status: string) =>
    http.patch<ErrorGroup>(
      ERRORS_ENDPOINTS.ONE(workspaceId, id),
      { status },
      { schema: errorGroupSchema }
    ),
}
