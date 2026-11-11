import { z } from "zod"

export const heartbeatStatusSchema = z.object({
  intervalSeconds: z.number(),
  graceSeconds: z.number(),
  state: z.string(),
  lastPingAt: z.string().nullable(),
})

export const alertSourceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  status: z.string(),
  url: z.string(),
  lastReceivedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  heartbeat: heartbeatStatusSchema.nullable(),
  createdAt: z.string(),
})
export type AlertSource = z.infer<typeof alertSourceSchema>

export const alertSourceWithTokenSchema = alertSourceSchema.extend({ token: z.string() })
export type AlertSourceWithToken = z.infer<typeof alertSourceWithTokenSchema>

export const alertViewSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  sourceKind: z.string(),
  routeName: z.string().nullable(),
  incidentId: z.string().nullable(),
  incidentTitle: z.string().nullable(),
  status: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.string(),
  sourceUrl: z.string().nullable(),
  occurrences: z.number(),
  firstFiredAt: z.string(),
  lastFiredAt: z.string(),
  resolvedAt: z.string().nullable(),
})
export type AlertView = z.infer<typeof alertViewSchema>

export const conditionSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.string().optional(),
})
export type Condition = z.infer<typeof conditionSchema>

export const alertRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number(),
  enabled: z.boolean(),
  sourceIds: z.array(z.string()),
  conditions: z.array(conditionSchema),
  groupBy: z.array(z.string()),
  createIncident: z.boolean(),
  incidentSeverity: z.string().nullable(),
  createdAt: z.string(),
})
export type AlertRoute = z.infer<typeof alertRouteSchema>

export interface CreateSourceRequest {
  kind: string
  name: string
  intervalSeconds?: number
  graceSeconds?: number
}

export interface RouteRequest {
  name: string
  enabled: boolean
  sourceIds: string[]
  conditions: Condition[]
  groupBy: string[]
  createIncident: boolean
  incidentSeverity: string | null
}

export const logAlertSchema = z.object({
  id: z.string(),
  name: z.string(),
  levels: z.array(z.string()),
  service: z.string().nullable(),
  contains: z.string().nullable(),
  threshold: z.number(),
  windowMinutes: z.number(),
  severity: z.string(),
  paused: z.boolean(),
  state: z.string(),
  stateSince: z.string(),
  lastCount: z.number().nullable(),
  lastCheckedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type LogAlert = z.infer<typeof logAlertSchema>

export interface LogAlertRequest {
  name: string
  levels: string[]
  service?: string | null
  contains?: string | null
  threshold: number
  windowMinutes: number
  severity: string
}
