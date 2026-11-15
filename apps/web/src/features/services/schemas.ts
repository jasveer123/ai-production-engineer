import { z } from "zod"

export const serviceLogSummarySchema = z.object({
  service: z.string(),
  environment: z.string(),
  total: z.number(),
  errors: z.number(),
  lastAt: z.string(),
  buckets: z.array(z.number()),
})
export type ServiceLogSummary = z.infer<typeof serviceLogSummarySchema>

export const serviceSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  bucketCount: z.number(),
  services: z.array(serviceLogSummarySchema),
})
export type ServiceSummary = z.infer<typeof serviceSummarySchema>

export const registeredServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  environment: z.string(),
})
export type RegisteredService = z.infer<typeof registeredServiceSchema>

export const serviceImpactSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  environment: z.string(),
  valuePerRequest: z.number().nullable(),
  currency: z.string().nullable(),
  failedRequests: z.number(),
  incidents: z.number(),
  impact: z.number().nullable(),
})
export type ServiceImpact = z.infer<typeof serviceImpactSchema>

export const businessImpactSchema = z.object({
  days: z.number(),
  services: z.array(serviceImpactSchema),
})
export type BusinessImpact = z.infer<typeof businessImpactSchema>

export interface SetValueRequest {
  name: string
  environment: string
  serviceId: string | null
  valuePerRequest: number
  currency: string
}

export const serviceRedSchema = z.object({
  service: z.string(),
  requests: z.number(),
  ratePerMin: z.number(),
  errors: z.number(),
  errorRate: z.number(),
  p50: z.number(),
  p95: z.number(),
  lastSeen: z.string(),
})
export type ServiceRed = z.infer<typeof serviceRedSchema>

export const serviceEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  calls: z.number(),
  errors: z.number(),
  errorRate: z.number(),
  avgMs: z.number(),
  lastSeen: z.string(),
  confidence: z.enum(["client_server", "parent_child"]),
})
export type ServiceEdge = z.infer<typeof serviceEdgeSchema>

export const serviceMapSchema = z.object({
  from: z.string(),
  to: z.string(),
  services: z.array(serviceRedSchema),
  edges: z.array(serviceEdgeSchema),
})
export type ServiceMap = z.infer<typeof serviceMapSchema>
