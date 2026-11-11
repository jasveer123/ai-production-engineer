import { z } from "zod"

export const targetSchema = z.object({
  kind: z.enum(["schedule", "user", "everyone"]),
  scheduleId: z.string().optional(),
  userId: z.string().optional(),
  label: z.string(),
})
export type Target = z.infer<typeof targetSchema>

export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  minSeverity: z.string(),
  enabled: z.boolean(),
  steps: z.array(z.object({ waitMinutes: z.number(), targets: z.array(targetSchema) })),
  createdAt: z.string(),
})
export type Policy = z.infer<typeof policySchema>

export const runSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  incidentTitle: z.string(),
  severity: z.string(),
  policyName: z.string(),
  state: z.string(),
  stepsDone: z.number(),
  totalSteps: z.number(),
  nextRunAt: z.string().nullable(),
  startedAt: z.string(),
  notifications: z.array(
    z.object({
      stepIndex: z.number(),
      email: z.string(),
      name: z.string().nullable(),
      status: z.string(),
      sentAt: z.string(),
    })
  ),
})
export type Run = z.infer<typeof runSchema>

export interface TargetRequest {
  kind: "schedule" | "user" | "everyone"
  scheduleId?: string
  userId?: string
}

export interface PolicyRequest {
  name: string
  minSeverity: string
  enabled: boolean
  steps: { waitMinutes: number; targets: TargetRequest[] }[]
}
