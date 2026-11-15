import { z } from "zod"

const keyValueSchema = z.object({ key: z.string(), value: z.string() })
const headerSchema = z.object({ name: z.string(), value: z.string() })
const maintenanceSchema = z.object({
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  weekdays: z.array(z.number()),
})

export const monitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  pronounceableName: z.string().nullable(),
  url: z.string().nullable(),
  host: z.string().nullable(),
  port: z.number().nullable(),
  keyword: z.string().nullable(),
  keywordMode: z.string(),
  expectedStatuses: z.array(z.number()),
  udpPayload: z.string().nullable(),
  dnsDomain: z.string().nullable(),
  dnsRecordType: z.string(),
  dnsExpected: z.string().nullable(),
  method: z.string(),
  headers: z.array(headerSchema),
  body: z.string().nullable(),
  followRedirects: z.boolean(),
  keepCookies: z.boolean(),
  basicAuthUser: z.string().nullable(),
  hasBasicAuthPassword: z.boolean(),
  timeoutSeconds: z.number(),
  ipVersion: z.string(),
  verifyTls: z.boolean(),
  intervalSeconds: z.number(),
  confirmationSeconds: z.number(),
  recoverySeconds: z.number(),
  sslExpiryDays: z.number().nullable(),
  domainExpiryDays: z.number().nullable(),
  maintenance: maintenanceSchema.nullable(),
  regions: z.array(z.string()),
  metadata: z.array(keyValueSchema),
  escalationPolicyId: z.string().nullable(),
  paused: z.boolean(),
  inMaintenance: z.boolean(),
  state: z.string(),
  stateSince: z.string(),
  lastCheckedAt: z.string().nullable(),
  lastStatusCode: z.number().nullable(),
  lastResponseMs: z.number().nullable(),
  lastError: z.string().nullable(),
  nextCheckAt: z.string().nullable(),
  sslExpiresAt: z.string().nullable(),
  domainExpiresAt: z.string().nullable(),
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
  region: z.string().nullable(),
  maintenance: z.boolean(),
  transition: z.string().nullable(),
  timings: z
    .object({
      dnsMs: z.number().nullable(),
      connectMs: z.number().nullable(),
      tlsMs: z.number().nullable(),
      firstByteMs: z.number().nullable(),
    })
    .nullable(),
})
export type Check = z.infer<typeof checkSchema>

export const availabilitySchema = z.object({
  period: z.string(),
  availability: z.number().nullable(),
  downtimeSeconds: z.number(),
  incidents: z.number(),
})
export type Availability = z.infer<typeof availabilitySchema>

export const monitorIncidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  startedAt: z.string(),
})
export type MonitorIncident = z.infer<typeof monitorIncidentSchema>

export const monitorDetailSchema = monitorSchema.extend({
  history: z.array(bucketSchema),
  recent: z.array(checkSchema),
  availability: z.array(availabilitySchema),
  incidents: z.array(monitorIncidentSchema),
  probeLocation: z.string(),
  badgeUrl: z.string(),
})
export type MonitorDetail = z.infer<typeof monitorDetailSchema>

export const bulkResultSchema = z.object({
  created: z.array(monitorSchema),
  failed: z.array(z.object({ url: z.string(), message: z.string() })),
})
export type BulkResult = z.infer<typeof bulkResultSchema>

export type MonitorSettings = Omit<
  Monitor,
  | "id"
  | "hasBasicAuthPassword"
  | "paused"
  | "inMaintenance"
  | "state"
  | "stateSince"
  | "lastCheckedAt"
  | "lastStatusCode"
  | "lastResponseMs"
  | "lastError"
  | "nextCheckAt"
  | "sslExpiresAt"
  | "domainExpiresAt"
  | "uptime24h"
  | "createdAt"
>

export type CreateMonitorRequest = MonitorSettings & { basicAuthPassword?: string | null }

export type UpdateMonitorRequest = Partial<CreateMonitorRequest> & { paused?: boolean }

export interface BulkCreateRequest {
  urls: string[]
  intervalSeconds: number
}
