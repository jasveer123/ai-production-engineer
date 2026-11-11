import { z } from "zod"
import { METRICS_ENDPOINTS, http } from "@/lib/api"
import {
  dashboardSchema,
  labelKeysSchema,
  metricNameSchema,
  seriesSchema,
  type Dashboard,
  type LabelKey,
  type MetricName,
  type MetricSeries,
  type Widget,
} from "../schemas"

export const metricsService = {
  names: (workspaceId: string) =>
    http.get<MetricName[]>(METRICS_ENDPOINTS.NAMES(workspaceId), {
      schema: z.array(metricNameSchema),
    }),

  labels: (workspaceId: string, name: string) =>
    http.get<LabelKey[]>(METRICS_ENDPOINTS.LABELS(workspaceId), {
      query: { name },
      schema: labelKeysSchema,
    }),

  series: (
    workspaceId: string,
    query: {
      name: string
      agg: string
      minutes: number
      service?: string
      groupBy?: string
      filters?: string
    }
  ) =>
    http.get<MetricSeries>(METRICS_ENDPOINTS.SERIES(workspaceId), { query, schema: seriesSchema }),

  dashboards: (workspaceId: string) =>
    http.get<Dashboard[]>(METRICS_ENDPOINTS.DASHBOARDS(workspaceId), {
      schema: z.array(dashboardSchema),
    }),

  createDashboard: (workspaceId: string, body: { name: string }) =>
    http.post<Dashboard>(METRICS_ENDPOINTS.DASHBOARDS(workspaceId), body, {
      schema: dashboardSchema,
    }),

  updateDashboard: (workspaceId: string, id: string, body: { widgets: Widget[] }) =>
    http.patch<Dashboard>(METRICS_ENDPOINTS.DASHBOARD(workspaceId, id), body, {
      schema: dashboardSchema,
    }),

  removeDashboard: (workspaceId: string, id: string) =>
    http.delete<void>(METRICS_ENDPOINTS.DASHBOARD(workspaceId, id)),
}
