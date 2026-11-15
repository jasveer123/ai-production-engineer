import { z } from "zod"
import { logLineSchema } from "./schemas"

const record = z.record(z.string(), z.unknown())

export const queryMetaSchema = z.object({
  from: z.string(),
  to: z.string(),
  matched: z.number(),
  matchedCapped: z.boolean(),
  returned: z.number(),
  truncated: z.boolean(),
  tookMs: z.number(),
})
export type QueryMeta = z.infer<typeof queryMetaSchema>

export const levelBucketSchema = z.object({
  at: z.string(),
  total: z.number(),
  levels: z.record(z.string(), z.number()),
})
export type LevelBucket = z.infer<typeof levelBucketSchema>

export const logExploreSchema = z.object({
  lines: z.array(logLineSchema),
  nextCursor: z.string().nullable(),
  histogram: z.array(levelBucketSchema),
  bucketMs: z.number(),
  meta: queryMetaSchema,
})
export type LogExplore = z.infer<typeof logExploreSchema>

const facetValueSchema = z.object({ value: z.string(), count: z.number() })
export type FacetValue = z.infer<typeof facetValueSchema>

export const logFacetsSchema = z.object({
  fields: z.array(z.object({ field: z.string(), values: z.array(facetValueSchema) })),
  attributeKeys: z.array(facetValueSchema),
  sampled: z.number(),
})
export type LogFacets = z.infer<typeof logFacetsSchema>

export const logContextSchema = z.object({
  anchor: logLineSchema,
  before: z.array(logLineSchema),
  after: z.array(logLineSchema),
})
export type LogContext = z.infer<typeof logContextSchema>

export const tailSchema = z.object({
  lines: z.array(logLineSchema),
  cursor: z.number(),
  gap: z.boolean(),
})
export type Tail = z.infer<typeof tailSchema>

export const traceSummarySchema = z.object({
  traceId: z.string(),
  start: z.string(),
  durationMs: z.number(),
  spanCount: z.number(),
  error: z.boolean(),
  rootService: z.string().nullable(),
  rootOperation: z.string().nullable(),
  services: z.array(z.string()),
})
export type TraceSummary = z.infer<typeof traceSummarySchema>

export const traceSearchSchema = z.object({
  traces: z.array(traceSummarySchema),
  nextBefore: z.string().nullable(),
  meta: queryMetaSchema,
})
export type TraceSearch = z.infer<typeof traceSearchSchema>

export const waterfallSpanSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().nullable(),
  service: z.string(),
  environment: z.string(),
  name: z.string(),
  kind: z.number(),
  start: z.string(),
  offsetMs: z.number(),
  durationMs: z.number(),
  statusCode: z.number(),
  statusMessage: z.string().nullable(),
  attributes: record,
  events: z.array(z.object({ name: z.string(), time: z.string(), attributes: record })),
  depth: z.number(),
  orphan: z.boolean(),
})
export type WaterfallSpan = z.infer<typeof waterfallSpanSchema>

export const traceDetailSchema = z.object({
  traceId: z.string(),
  start: z.string().nullable(),
  durationMs: z.number(),
  spans: z.array(waterfallSpanSchema),
  missingRoot: z.boolean(),
  orphanCount: z.number(),
  truncated: z.boolean(),
  logs: z.array(logLineSchema),
})
export type TraceDetail = z.infer<typeof traceDetailSchema>

export const operationStatsSchema = z.object({
  service: z.string(),
  operation: z.string(),
  count: z.number(),
  errors: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
})
export type OperationStats = z.infer<typeof operationStatsSchema>

export const savedQuerySchema = z.object({
  id: z.string(),
  name: z.string(),
  signal: z.enum(["logs", "traces"]),
  query: z.string(),
  range: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
})
export type SavedQuery = z.infer<typeof savedQuerySchema>

export interface ExploreParams {
  q: string
  range: string
  from?: string
  to?: string
}
