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
})

export const labelKeysSchema = z.array(z.object({ key: z.string(), values: z.array(z.string()) }))
export type LabelKey = z.infer<typeof labelKeysSchema>[number]
export type MetricSeries = z.infer<typeof seriesSchema>

export const widgetSchema = z.object({
  id: z.string(),
  title: z.string(),
  metric: z.string(),
  agg: z.string(),
  service: z.string().optional(),
  groupBy: z.string().optional(),
  filters: z.string().optional(),
})
export type Widget = z.infer<typeof widgetSchema>

export const dashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  widgets: z.array(widgetSchema),
  createdAt: z.string(),
})
export type Dashboard = z.infer<typeof dashboardSchema>
