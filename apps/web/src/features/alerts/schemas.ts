import { z } from "zod"

export const heartbeatStatusSchema = z.object({
  intervalSeconds: z.number(),
  graceSeconds: z.number(),
  state: z.string(),
  paused: z.boolean().default(false),
  lastPingAt: z.string().nullable(),
  dueAt: z.string().nullable().default(null),
  running: z
    .object({ executionId: z.string().nullable(), startedAt: z.string() })
    .nullable()
    .default(null),
  metadata: z.record(z.string(), z.string()).default({}),
})

export const alertSourceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  status: z.string(),
  url: z.string(),
  lastReceivedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  escalationPolicyId: z.string().nullable().default(null),
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

export const heartbeatPingSchema = z.object({
  id: z.number(),
  signal: z.string(),
  outcome: z.string(),
  executionId: z.string().nullable(),
  durationMs: z.number().nullable(),
  body: z.string().nullable(),
  receivedAt: z.string(),
})
export type HeartbeatPing = z.infer<typeof heartbeatPingSchema>

export const heartbeatDetailSchema = z.object({
  source: alertSourceSchema,
  pingUrl: z.string().nullable(),
  pings: z.array(heartbeatPingSchema),
})
export type HeartbeatDetail = z.infer<typeof heartbeatDetailSchema>

export const alertReceiptSchema = z.object({
  id: z.string(),
  externalEventId: z.string(),
  outcome: z.string(),
  reason: z.string().nullable(),
  attempts: z.number(),
  duplicates: z.number(),
  receivedAt: z.string(),
  processedAt: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
})
export type AlertReceipt = z.infer<typeof alertReceiptSchema>

export const routePreviewSchema = z.object({
  error: z.string().nullable(),
  alerts: z.array(
    z.object({
      title: z.string(),
      status: z.string(),
      severity: z.string(),
      dedupKey: z.string(),
      route: z.object({ id: z.string(), name: z.string() }).nullable(),
      groupKey: z.string().nullable(),
      createsIncident: z.boolean(),
    })
  ),
})
export type RoutePreview = z.infer<typeof routePreviewSchema>

export interface CreateSourceRequest {
  kind: string
  name: string
  intervalSeconds?: number
  graceSeconds?: number
  metadata?: Record<string, string>
  escalationPolicyId?: string | null
}

export interface UpdateSourceRequest {
  name?: string
  intervalSeconds?: number
  graceSeconds?: number
  metadata?: Record<string, string>
  escalationPolicyId?: string | null
  paused?: boolean
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
