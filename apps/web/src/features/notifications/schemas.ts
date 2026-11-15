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
  incidentId: z.string().nullable(),
  runId: z.string().nullable(),
  stepIndex: z.number().nullable(),
  eventType: z.string(),
  channel: z.string(),
  channelName: z.string().nullable(),
  recipientName: z.string().nullable(),
  address: z.string(),
  state: z.string(),
  attempts: z.number(),
  maxAttempts: z.number(),
  providerMessageId: z.string().nullable(),
  responseStatus: z.number().nullable(),
  error: z.string().nullable(),
  nextAttemptAt: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
})
export type Delivery = z.infer<typeof deliverySchema>

export const testResultSchema = z.object({
  ok: z.boolean(),
  state: z.string(),
  status: z.number().nullable(),
  error: z.string().nullable(),
  providerMessageId: z.string().nullable(),
})
export type TestResult = z.infer<typeof testResultSchema>

export const contactMethodSchema = z.object({
  id: z.string(),
  kind: z.string(),
  address: z.string(),
  minSeverity: z.string(),
  createdAt: z.string(),
})
export type ContactMethod = z.infer<typeof contactMethodSchema>

export const providersSchema = z.object({ email: z.boolean(), twilio: z.boolean() })
export type Providers = z.infer<typeof providersSchema>

export interface ContactMethodRequest {
  kind: string
  address: string
  minSeverity: string
}

export interface DeliveryFilter {
  state?: string
  channel?: string
}

export interface CreateChannelRequest {
  kind: string
  name: string
  webhookUrl?: string
  url?: string
  phone?: string
  email?: string
  events: string[]
  minSeverity: string
}

export interface UpdateChannelRequest {
  name?: string
  events?: string[]
  minSeverity?: string
  enabled?: boolean
}
