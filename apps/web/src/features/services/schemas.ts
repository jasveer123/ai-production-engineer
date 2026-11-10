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
