import { z } from "zod"
import { personSchema } from "./schemas"

export const activityEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  at: z.string(),
  summary: z.string(),
  source: z.string(),
  actor: personSchema.nullable(),
  editable: z.boolean(),
  body: z.string().nullable(),
  region: z.string().nullable(),
  statusCode: z.number().nullable(),
  channel: z.string().nullable(),
  address: z.string().nullable(),
  deliveryStatus: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
})
export type ActivityEntry = z.infer<typeof activityEntrySchema>

export const activityPageSchema = z.object({
  entries: z.array(activityEntrySchema),
  nextCursor: z.string().nullable(),
})
export type ActivityPage = z.infer<typeof activityPageSchema>

export const capturedResponseSchema = z.object({
  checkedAt: z.string(),
  statusCode: z.number().nullable(),
  error: z.string().nullable(),
  region: z.string().nullable(),
  headers: z.record(z.string(), z.string()).nullable(),
  bodyPreview: z.string().nullable(),
})
export type CapturedResponse = z.infer<typeof capturedResponseSchema>

export const incidentContextSchema = z.object({
  monitor: z
    .object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      url: z.string().nullable(),
      method: z.string(),
    })
    .nullable(),
  replayCommand: z.string().nullable(),
  lastResponse: capturedResponseSchema.nullable(),
  escalations: z.array(
    z.object({
      policyId: z.string().nullable(),
      policyName: z.string(),
      state: z.string(),
      stepIndex: z.number(),
      nextRunAt: z.string().nullable(),
    })
  ),
  inheritedMetadata: z.record(z.string(), z.string()),
})
export type IncidentContext = z.infer<typeof incidentContextSchema>

export const policyOptionSchema = z.object({ id: z.string(), name: z.string() }).passthrough()
export type PolicyOption = z.infer<typeof policyOptionSchema>

export const memberOptionSchema = z
  .object({ userId: z.string(), email: z.string(), name: z.string().nullable() })
  .passthrough()
export type MemberOption = z.infer<typeof memberOptionSchema>

export type ResponseAction = "acknowledge" | "unacknowledge" | "resolve" | "reopen"

export interface ResponseRequest {
  action: ResponseAction
  expectedVersion: number
  reason?: string
}

export interface IncidentUpdate {
  title?: string
  description?: string | null
  severity?: string
  assigneeId?: string | null
  expectedVersion?: number
}

export interface ReportIncidentRequest {
  title: string
  description?: string
  severity: string
  monitorId?: string
  notify: "none" | "policy" | "team"
  policyId?: string
}

export interface IncidentListFilters {
  state: string
  severity: string
  monitorId: string
  q: string
  from: string
  to: string
  offset: number
}
