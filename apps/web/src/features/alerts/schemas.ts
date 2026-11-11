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
