import { INGEST_ENDPOINTS, http } from "@/lib/api"
import { logSearchSchema, type LogSearch } from "../schemas"

interface SearchParams {
  q: string
  limit: number
  from?: string
  before?: number
}

export const logsService = {
  search: (workspaceId: string, params: SearchParams) =>
    http.get<LogSearch>(INGEST_ENDPOINTS.LOGS(workspaceId), {
      query: { ...params },
      schema: logSearchSchema,
    }),
}
