import { z } from "zod"

export const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: z.string(),
  createdAt: z.string(),
})
export type Member = z.infer<typeof memberSchema>

export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
})
export type Invitation = z.infer<typeof invitationSchema>

export const invitationWithLinkSchema = invitationSchema.extend({ inviteUrl: z.string() })
export type InvitationWithLink = z.infer<typeof invitationWithLinkSchema>

export const approvalSchema = z.object({ prMinRole: z.string() })

export const usageSchema = z.object({
  months: z.array(
    z.object({
      month: z.string(),
      investigations: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      aiCostUsd: z.number(),
      sandboxMinutes: z.number(),
    })
  ),
  limits: z.object({
    monthlyAiBudgetUsd: z.number().nullable(),
    maxConcurrentInvestigations: z.number().nullable(),
  }),
  runningInvestigations: z.number(),
  blockedReason: z.string().nullable(),
})
export type Usage = z.infer<typeof usageSchema>

export const auditEventSchema = z.object({
  id: z.string(),
  actorEmail: z.string().nullable(),
  actorType: z.string(),
  action: z.string(),
  resourceType: z.string(),
  outcome: z.string(),
  occurredAt: z.string(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>
