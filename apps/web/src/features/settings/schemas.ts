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

export const severityRuleSchema = z.object({
  environment: z.string().optional(),
  serviceName: z.string().optional(),
  errorType: z.string().optional(),
  severity: z.string(),
})
export type SeverityRule = z.infer<typeof severityRuleSchema>

export const apiTokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  workspaceId: z.string().nullable().default(null),
  scopes: z.array(z.string()).default([]),
  areas: z.array(z.string()).default([]),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type ApiToken = z.infer<typeof apiTokenSchema>
export const apiTokenWithSecretSchema = apiTokenSchema.extend({ token: z.string() })
export type ApiTokenWithSecret = z.infer<typeof apiTokenWithSecretSchema>

export const systemStatusSchema = z.object({
  status: z.string(),
  checkedAt: z.string(),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      latencyMs: z.number().nullable(),
      detail: z.string().nullable(),
    })
  ),
})
export type SystemStatus = z.infer<typeof systemStatusSchema>

export interface CreateApiTokenRequest {
  name: string
  workspaceId: string
  scopes: string[]
  areas: string[]
  expiresInDays: number | null
}
