import { z } from "zod"

export const metricNameSchema = z.object({
  name: z.string(),
  kind: z.string(),
  unit: z.string().nullable(),
  services: z.array(z.string()),
  points: z.number(),
  lastAt: z.string(),
})
export type MetricName = z.infer<typeof metricNameSchema>

const bucketsSchema = z.array(z.object({ at: z.string(), value: z.number().nullable() }))

export const seriesSchema = z.object({
  name: z.string(),
  agg: z.string(),
  unit: z.string().nullable(),
  buckets: bucketsSchema,
  groups: z.array(z.object({ key: z.string(), buckets: bucketsSchema })).optional(),
  truncated: z.boolean().optional(),
})

export const labelKeysSchema = z.array(z.object({ key: z.string(), values: z.array(z.string()) }))
export type LabelKey = z.infer<typeof labelKeysSchema>[number]
export type MetricSeries = z.infer<typeof seriesSchema>

export const CHART_TYPES = ["line", "area", "bar", "stat", "table"] as const
export type ChartType = (typeof CHART_TYPES)[number]

export const widgetSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(80),
  metric: z.string().min(1).max(200),
  agg: z.string(),
  service: z.string().optional(),
  groupBy: z.string().optional(),
  filters: z.string().optional(),
  chart: z.enum(CHART_TYPES).default("line"),
})
export type Widget = z.infer<typeof widgetSchema>

export const variableSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().optional(),
})
export type DashboardVariable = z.infer<typeof variableSchema>

export const dashboardBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  widgets: z.array(widgetSchema).max(24).default([]),
  variables: z.array(variableSchema).max(10).default([]),
})
export type DashboardBody = z.infer<typeof dashboardBodySchema>

export const dashboardSchema = dashboardBodySchema.extend({
  id: z.string(),
  createdAt: z.string(),
})
export type Dashboard = z.infer<typeof dashboardSchema>

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  dashboard: dashboardBodySchema,
})
export type DashboardTemplate = z.infer<typeof templateSchema>

export const ALERT_STATES = ["ok", "pending", "firing", "recovering", "no_data", "error"] as const

export const metricAlertFormSchema = z.object({
  name: z.string().trim().min(1, "Name the alert").max(80),
  type: z.enum(["threshold", "relative", "anomaly"]),
  operator: z.enum(["above", "below"]),
  threshold: z.number({ message: "Enter a number" }),
  windowMinutes: z.number().int().min(1).max(1440),
  everySeconds: z.number().int().min(30).max(3600),
  perSeries: z.boolean(),
  confirmationSeconds: z.number().int().min(0).max(86400),
  recoverySeconds: z.number().int().min(0).max(86400),
  missingData: z.enum(["alert", "ok", "keep"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  escalationPolicyId: z.string(),
})
export type MetricAlertForm = z.infer<typeof metricAlertFormSchema>

export const metricAlertSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: z.object({
    metric: z.string(),
    agg: z.string(),
    service: z.string().optional(),
    groupBy: z.string().optional(),
    filters: z.string().optional(),
  }),
  condition: z.object({ type: z.string(), operator: z.string(), threshold: z.number() }),
  windowMinutes: z.number(),
  everySeconds: z.number(),
  perSeries: z.boolean(),
  confirmationSeconds: z.number(),
  recoverySeconds: z.number(),
  missingData: z.string(),
  severity: z.string(),
  escalationPolicyId: z.string().nullable(),
  paused: z.boolean(),
  state: z.enum(ALERT_STATES),
  series: z.array(
    z.object({
      series: z.string(),
      state: z.enum(ALERT_STATES),
      since: z.string(),
      lastValue: z.number().nullable(),
      observation: z.string().nullable(),
    })
  ),
  lastEvaluatedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
})
export type MetricAlert = z.infer<typeof metricAlertSchema>
