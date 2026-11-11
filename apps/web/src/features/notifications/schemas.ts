import { z } from "zod"

export const channelSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  target: z.string(),
  events: z.array(z.string()),
  minSeverity: z.string(),
  enabled: z.boolean(),
  lastDeliveryAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
})
export type Channel = z.infer<typeof channelSchema>

export const channelWithSecretSchema = channelSchema.extend({
  signingSecret: z.string().nullable().optional(),
})
export type ChannelWithSecret = z.infer<typeof channelWithSecretSchema>

export const deliverySchema = z.object({
  id: z.string(),
  channelName: z.string(),
  eventType: z.string(),
  incidentId: z.string().nullable(),
  status: z.string(),
  attempts: z.number(),
  responseStatus: z.number().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
})
export type Delivery = z.infer<typeof deliverySchema>

export const testResultSchema = z.object({
  ok: z.boolean(),
  status: z.number().nullable(),
  error: z.string().nullable(),
})
export type TestResult = z.infer<typeof testResultSchema>

export interface CreateChannelRequest {
  kind: string
  name: string
  webhookUrl?: string
  url?: string
  phone?: string
  events: string[]
  minSeverity: string
}

export interface UpdateChannelRequest {
  name?: string
  events?: string[]
  minSeverity?: string
  enabled?: boolean
}
