import { z } from "zod"
import { SETTINGS_ENDPOINTS, http } from "@/lib/api"
import {
  approvalSchema,
  auditEventSchema,
  invitationSchema,
  invitationWithLinkSchema,
  memberSchema,
  usageSchema,
  type AuditEvent,
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
}
