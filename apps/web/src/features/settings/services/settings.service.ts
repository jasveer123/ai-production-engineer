import { z } from "zod"
import { SETTINGS_ENDPOINTS, http } from "@/lib/api"
import {
  approvalSchema,
  apiTokenSchema,
  apiTokenWithSecretSchema,
  systemStatusSchema,
  type CreateApiTokenRequest,
  type SystemStatus,
  auditEventSchema,
  severityRuleSchema,
  invitationSchema,
  invitationWithLinkSchema,
  memberSchema,
  usageSchema,
  type ApiToken,
  type ApiTokenWithSecret,
  type AuditEvent,
  type SeverityRule,
  type Invitation,
  type InvitationWithLink,
  type Member,
  type Usage,
} from "../schemas"

export const settingsService = {
  rename: (workspaceId: string, name: string) =>
    http.patch<unknown>(SETTINGS_ENDPOINTS.WORKSPACE(workspaceId), { name }),

  members: (workspaceId: string) =>
    http.get<Member[]>(SETTINGS_ENDPOINTS.MEMBERS(workspaceId), { schema: z.array(memberSchema) }),

  setRole: (workspaceId: string, id: string, role: string) =>
    http.patch<Member>(
      SETTINGS_ENDPOINTS.MEMBER(workspaceId, id),
      { role },
      { schema: memberSchema }
    ),

  removeMember: (workspaceId: string, id: string) =>
    http.delete<void>(SETTINGS_ENDPOINTS.MEMBER(workspaceId, id)),

  invitations: (workspaceId: string) =>
    http.get<Invitation[]>(SETTINGS_ENDPOINTS.INVITATIONS(workspaceId), {
      schema: z.array(invitationSchema),
    }),

  invite: (workspaceId: string, body: { email: string; role: string }) =>
    http.post<InvitationWithLink>(SETTINGS_ENDPOINTS.INVITATIONS(workspaceId), body, {
      schema: invitationWithLinkSchema,
    }),

  revokeInvitation: (workspaceId: string, id: string) =>
    http.delete<void>(SETTINGS_ENDPOINTS.INVITATION(workspaceId, id)),

  approval: (workspaceId: string) =>
    http.get<{ prMinRole: string }>(SETTINGS_ENDPOINTS.APPROVAL(workspaceId), {
      schema: approvalSchema,
    }),

  setApproval: (workspaceId: string, prMinRole: string) =>
    http.put<{ prMinRole: string }>(
      SETTINGS_ENDPOINTS.APPROVAL(workspaceId),
      { prMinRole },
      { schema: approvalSchema }
    ),

  usage: (workspaceId: string) =>
    http.get<Usage>(SETTINGS_ENDPOINTS.USAGE(workspaceId), { schema: usageSchema }),

  setLimits: (
    workspaceId: string,
    body: { monthlyAiBudgetUsd: number | null; maxConcurrentInvestigations: number | null }
  ) => http.put<Usage>(SETTINGS_ENDPOINTS.LIMITS(workspaceId), body, { schema: usageSchema }),

  audit: (workspaceId: string) =>
    http.get<AuditEvent[]>(SETTINGS_ENDPOINTS.AUDIT(workspaceId), {
      query: { limit: 50 },
      schema: z.array(auditEventSchema),
    }),

  severityRules: (workspaceId: string) =>
    http.get<SeverityRule[]>(SETTINGS_ENDPOINTS.SEVERITY_RULES(workspaceId), {
      schema: z.array(severityRuleSchema),
    }),

  setSeverityRules: (workspaceId: string, rules: SeverityRule[]) =>
    http.put<SeverityRule[]>(
      SETTINGS_ENDPOINTS.SEVERITY_RULES(workspaceId),
      { rules },
      { schema: z.array(severityRuleSchema) }
    ),

  apiTokens: () =>
    http.get<ApiToken[]>(SETTINGS_ENDPOINTS.API_TOKENS, { schema: z.array(apiTokenSchema) }),

  createApiToken: (body: CreateApiTokenRequest) =>
    http.post<ApiTokenWithSecret>(SETTINGS_ENDPOINTS.API_TOKENS, body, {
      schema: apiTokenWithSecretSchema,
    }),

  revokeApiToken: (id: string) => http.delete<void>(SETTINGS_ENDPOINTS.API_TOKEN(id)),

  systemStatus: (workspaceId: string) =>
    http.get<SystemStatus>(SETTINGS_ENDPOINTS.SYSTEM_STATUS(workspaceId), {
      schema: systemStatusSchema,
    }),
}
