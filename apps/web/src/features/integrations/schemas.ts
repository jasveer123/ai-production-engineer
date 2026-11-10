import { z } from "zod"

export const INGEST_WAYS = ["package", "otlp", "http", "agent", "drain", "syslog"] as const

export const STREAM_STATES = ["receiving", "silent", "not_set_up"] as const

export const ingestWaySchema = z.enum(INGEST_WAYS)
export const streamStateSchema = z.enum(STREAM_STATES)

export type IngestWay = z.infer<typeof ingestWaySchema>
export type StreamState = z.infer<typeof streamStateSchema>

export const ingestTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  masked: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})
export type IngestToken = z.infer<typeof ingestTokenSchema>

export const ingestTokenWithSecretSchema = ingestTokenSchema.extend({ token: z.string() })
export type IngestTokenWithSecret = z.infer<typeof ingestTokenWithSecretSchema>

export const ingestOverviewSchema = z.object({
  ingestUrl: z.string(),
  syslog: z.object({ host: z.string(), port: z.number(), tls: z.boolean() }).nullable(),
  tokens: z.array(ingestTokenSchema),
  ways: z.array(
    z.object({
      way: ingestWaySchema,
      state: streamStateSchema,
      lastReceivedAt: z.string().nullable(),
    })
  ),
  streams: z.array(
    z.object({
      way: ingestWaySchema,
      serviceName: z.string(),
      environment: z.string(),
      host: z.string().nullable(),
      state: streamStateSchema,
      firstReceivedAt: z.string(),
      lastReceivedAt: z.string(),
      logCount: z.number(),
      spanCount: z.number(),
      errorCount: z.number(),
      metricCount: z.number(),
    })
  ),
})
export type IngestOverview = z.infer<typeof ingestOverviewSchema>

export const logLineSchema = z.object({
  id: z.number(),
  ts: z.string(),
  service: z.string(),
  environment: z.string(),
  level: z.string(),
  message: z.string(),
  host: z.string().nullable(),
  way: ingestWaySchema,
})
export type LogLine = z.infer<typeof logLineSchema>

export const histogramBucketSchema = z.object({
  at: z.string(),
  total: z.number(),
  errors: z.number(),
})
export type HistogramBucket = z.infer<typeof histogramBucketSchema>

export const logSearchResultSchema = z.object({
  lines: z.array(logLineSchema),
  services: z.array(z.string()),
  histogram: z.array(histogramBucketSchema),
})
export type LogSearchResult = z.infer<typeof logSearchResultSchema>

export interface CreateTokenRequest {
  name: string
}

export interface TestLogRequest {
  token: string
}

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  severity: z.string(),
  serviceName: z.string().nullable(),
  eventCount: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
})
export type Incident = z.infer<typeof incidentSchema>

export const pullRequestSchema = z.object({
  id: z.string(),
  number: z.number().nullable(),
  url: z.string().nullable(),
  title: z.string().nullable(),
  incidentTitle: z.string().nullable(),
  status: z.string(),
  checksStatus: z.string(),
  createdAt: z.string(),
})
export type PullRequest = z.infer<typeof pullRequestSchema>
