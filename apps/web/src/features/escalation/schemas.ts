import { z } from "zod"

export const targetSchema = z.object({
  kind: z.enum(["schedule", "user", "everyone", "channel"]),
  scheduleId: z.string().optional(),
  userId: z.string().optional(),
  channelId: z.string().optional(),
  label: z.string(),
})
export type Target = z.infer<typeof targetSchema>

const stepSchema = z.object({
  waitMinutes: z.number(),
  targets: z.array(targetSchema),
  channels: z.array(z.string()),
})
export type Step = z.infer<typeof stepSchema>

const conditionSchema = z.object({
  minSeverity: z.string().optional(),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  timeWindow: z
    .object({ days: z.array(z.number()), from: z.string(), to: z.string(), timezone: z.string() })
    .optional(),
})
export type Condition = z.infer<typeof conditionSchema>

export const policySchema = z.object({
  id: z.string(),
  name: z.string(),
  minSeverity: z.string(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  generated: z.boolean(),
  repeatCount: z.number(),
  steps: z.array(stepSchema),
  branches: z.array(
    z.object({ name: z.string(), when: conditionSchema, steps: z.array(stepSchema) })
  ),
  createdAt: z.string(),
})
export type Policy = z.infer<typeof policySchema>

export const previewSchema = z.object({
  branch: z.string().nullable(),
  steps: z.array(
    z.object({
      waitMinutes: z.number(),
      recipients: z.array(
        z.object({
          name: z.string(),
          channel: z.string(),
          address: z.string(),
          problem: z.string().nullable(),
        })
      ),
    })
  ),
})
export type Preview = z.infer<typeof previewSchema>

const runDeliverySchema = z.object({
  id: z.string(),
  stepIndex: z.number().nullable(),
  channel: z.string(),
  recipientName: z.string().nullable(),
  address: z.string(),
  state: z.string(),
  error: z.string().nullable(),
})

export const runSchema = z.object({
  id: z.string(),
  incidentId: z.string(),
  incidentTitle: z.string(),
  severity: z.string(),
  policyName: z.string(),
  policySource: z.string(),
  branch: z.string().nullable(),
  state: z.string(),
  stepsDone: z.number(),
  totalSteps: z.number(),
  repeatsDone: z.number(),
  repeatCount: z.number(),
  nextRunAt: z.string().nullable(),
  startedAt: z.string(),
  deliveries: z.array(runDeliverySchema),
})
export type Run = z.infer<typeof runSchema>

export interface TargetRequest {
  kind: "schedule" | "user" | "everyone" | "channel"
  scheduleId?: string
  userId?: string
  channelId?: string
}

export interface StepRequest {
  waitMinutes: number
  targets: TargetRequest[]
  channels: string[]
}

export interface BranchRequest {
  name: string
  when: Condition
  steps: StepRequest[]
}

export interface PolicyRequest {
  name: string
  minSeverity: string
  enabled: boolean
  isDefault: boolean
  repeatCount: number
  steps: StepRequest[]
  branches: BranchRequest[]
}

export interface SimplePolicyRequest {
  primary: { kind: "schedule"; scheduleId: string } | { kind: "user"; userId: string }
  channels: string[]
  escalateAfterMinutes: number | null
}
