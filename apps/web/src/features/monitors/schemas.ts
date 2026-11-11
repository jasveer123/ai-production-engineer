import { z } from "zod"

export const monitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  url: z.string().nullable(),
  host: z.string().nullable(),
  port: z.number().nullable(),
  expectedStatus: z.number().nullable(),
  keyword: z.string().nullable(),
  keywordMode: z.string(),
  intervalSeconds: z.number(),
  timeoutSeconds: z.number(),
  confirmations: z.number(),
  paused: z.boolean(),
  state: z.string(),
  stateSince: z.string(),
  lastCheckedAt: z.string().nullable(),
  lastStatusCode: z.number().nullable(),
  lastResponseMs: z.number().nullable(),
  lastError: z.string().nullable(),
  uptime24h: z.number().nullable(),
  createdAt: z.string(),
})
export type Monitor = z.infer<typeof monitorSchema>

export const bucketSchema = z.object({
  at: z.string(),
  total: z.number(),
  failures: z.number(),
  avgMs: z.number().nullable(),
})
export type Bucket = z.infer<typeof bucketSchema>

export const checkSchema = z.object({
  id: z.number(),
  checkedAt: z.string(),
  ok: z.boolean(),
  statusCode: z.number().nullable(),
  responseMs: z.number(),
  error: z.string().nullable(),
})
export type Check = z.infer<typeof checkSchema>

export const monitorDetailSchema = monitorSchema.extend({
  history: z.array(bucketSchema),
  recent: z.array(checkSchema),
})
export type MonitorDetail = z.infer<typeof monitorDetailSchema>

export interface CreateMonitorRequest {
  name: string
  kind: string
  url?: string
  host?: string
  port?: number
  intervalSeconds: number
  confirmations: number
  expectedStatus?: number
  keyword?: string
  keywordMode?: string
}

export interface UpdateMonitorRequest {
  name?: string
  paused?: boolean
  intervalSeconds?: number
  confirmations?: number
  url?: string
  host?: string
  port?: number
  expectedStatus?: number
  keyword?: string
  keywordMode?: string
}
