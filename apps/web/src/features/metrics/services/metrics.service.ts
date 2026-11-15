import { z } from "zod"
import { METRICS_ENDPOINTS, http } from "@/lib/api"
import {
  dashboardSchema,
  labelKeysSchema,
  metricAlertSchema,
  metricNameSchema,
  seriesSchema,
  templateSchema,
  type Dashboard,
  type DashboardBody,
  type DashboardTemplate,
  type LabelKey,
  type MetricAlert,
  type MetricName,
  type MetricSeries,
} from "../schemas"

export type SeriesQuery = {
  name: string
  agg: string
  minutes: number
  service?: string
  groupBy?: string
  filters?: string
}

export interface MetricAlertBody {
  name: string
  query: { metric: string; agg: string; service?: string; groupBy?: string; filters?: string }
  condition: { type: string; operator: string; threshold: number }
  windowMinutes: number
  everySeconds: number
  perSeries: boolean
  confirmationSeconds: number
  recoverySeconds: number
  missingData: string
  severity: string
  escalationPolicyId: string | null
}

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

  series: (workspaceId: string, query: SeriesQuery) =>
    http.get<MetricSeries>(METRICS_ENDPOINTS.SERIES(workspaceId), { query, schema: seriesSchema }),

  dashboards: (workspaceId: string) =>
    http.get<Dashboard[]>(METRICS_ENDPOINTS.DASHBOARDS(workspaceId), {
      schema: z.array(dashboardSchema),
    }),

  templates: (workspaceId: string) =>
    http.get<DashboardTemplate[]>(METRICS_ENDPOINTS.TEMPLATES(workspaceId), {
      schema: z.array(templateSchema),
    }),

  createDashboard: (workspaceId: string, body: Partial<DashboardBody> & { name: string }) =>
    http.post<Dashboard>(METRICS_ENDPOINTS.DASHBOARDS(workspaceId), body, {
      schema: dashboardSchema,
    }),

  updateDashboard: (workspaceId: string, id: string, body: Partial<DashboardBody>) =>
    http.patch<Dashboard>(METRICS_ENDPOINTS.DASHBOARD(workspaceId, id), body, {
      schema: dashboardSchema,
    }),

  removeDashboard: (workspaceId: string, id: string) =>
    http.delete<void>(METRICS_ENDPOINTS.DASHBOARD(workspaceId, id)),

  alerts: (workspaceId: string) =>
    http.get<MetricAlert[]>(METRICS_ENDPOINTS.ALERTS(workspaceId), {
      schema: z.array(metricAlertSchema),
    }),

  createAlert: (workspaceId: string, body: MetricAlertBody) =>
    http.post<MetricAlert>(METRICS_ENDPOINTS.ALERTS(workspaceId), body, {
      schema: metricAlertSchema,
    }),

  updateAlert: (
    workspaceId: string,
    id: string,
    body: Partial<MetricAlertBody> & { paused?: boolean }
  ) =>
    http.patch<MetricAlert>(METRICS_ENDPOINTS.ALERT(workspaceId, id), body, {
      schema: metricAlertSchema,
    }),

  checkAlert: (workspaceId: string, id: string) =>
    http.post<MetricAlert>(
      METRICS_ENDPOINTS.ALERT_CHECK(workspaceId, id),
      {},
      {
        schema: metricAlertSchema,
      }
    ),

  removeAlert: (workspaceId: string, id: string) =>
    http.delete<void>(METRICS_ENDPOINTS.ALERT(workspaceId, id)),
}
