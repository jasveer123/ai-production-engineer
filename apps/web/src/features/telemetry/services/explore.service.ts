import { z } from "zod"
import { EXPLORE_ENDPOINTS, http } from "@/lib/api"
import {
  logContextSchema,
  logExploreSchema,
  logFacetsSchema,
  operationStatsSchema,
  savedQuerySchema,
  tailSchema,
  traceDetailSchema,
  traceSearchSchema,
  type ExploreParams,
  type LogContext,
  type LogExplore,
  type LogFacets,
  type OperationStats,
  type SavedQuery,
  type Tail,
  type TraceDetail,
  type TraceSearch,
} from "../explore-schemas"

const rangeQuery = ({ q, range, from, to }: ExploreParams) =>
  from && to ? { q, from, to } : { q, range }

export const exploreService = {
  logs: (workspaceId: string, params: ExploreParams, cursor?: string) =>
    http.get<LogExplore>(EXPLORE_ENDPOINTS.LOGS(workspaceId), {
      query: { ...rangeQuery(params), cursor, limit: 100 },
      schema: logExploreSchema,
    }),

  facets: (workspaceId: string, params: ExploreParams, field?: string) =>
    http.get<LogFacets>(EXPLORE_ENDPOINTS.FACETS(workspaceId), {
      query: { ...rangeQuery(params), field },
      schema: logFacetsSchema,
    }),

  context: (workspaceId: string, logId: number) =>
    http.get<LogContext>(EXPLORE_ENDPOINTS.CONTEXT(workspaceId, logId), {
      query: { size: 25 },
      schema: logContextSchema,
    }),

  tail: (workspaceId: string, q: string, after: number | null) =>
    http.get<Tail>(EXPLORE_ENDPOINTS.TAIL(workspaceId), {
      query: { q, after: after ?? undefined, limit: 200 },
      schema: tailSchema,
    }),

  traces: (workspaceId: string, params: ExploreParams, before?: string) =>
    http.get<TraceSearch>(EXPLORE_ENDPOINTS.TRACES(workspaceId), {
      query: { ...rangeQuery(params), before, limit: 50 },
      schema: traceSearchSchema,
    }),

  operations: (workspaceId: string, params: ExploreParams) =>
    http.get<OperationStats[]>(EXPLORE_ENDPOINTS.OPERATIONS(workspaceId), {
      query: rangeQuery(params),
      schema: z.array(operationStatsSchema),
    }),

  trace: (workspaceId: string, traceId: string) =>
    http.get<TraceDetail>(EXPLORE_ENDPOINTS.TRACE(workspaceId, traceId), {
      schema: traceDetailSchema,
    }),

  saved: (workspaceId: string, signal: SavedQuery["signal"]) =>
    http.get<SavedQuery[]>(EXPLORE_ENDPOINTS.SAVED(workspaceId), {
      query: { signal },
      schema: z.array(savedQuerySchema),
    }),

  createSaved: (
    workspaceId: string,
    body: { name: string; signal: SavedQuery["signal"]; query: string; range: string }
  ) =>
    http.post<SavedQuery>(EXPLORE_ENDPOINTS.SAVED(workspaceId), body, {
      schema: savedQuerySchema,
    }),

  deleteSaved: (workspaceId: string, id: string) =>
    http.delete<void>(EXPLORE_ENDPOINTS.SAVED_ITEM(workspaceId, id)),
}
