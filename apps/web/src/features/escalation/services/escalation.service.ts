import { z } from "zod"
import { ESCALATION_ENDPOINTS, http } from "@/lib/api"
import {
  policySchema,
  previewSchema,
  runSchema,
  type Policy,
  type PolicyRequest,
  type Preview,
  type Run,
  type SimplePolicyRequest,
} from "../schemas"

export const escalationService = {
  policies: (workspaceId: string) =>
    http.get<Policy[]>(ESCALATION_ENDPOINTS.POLICIES(workspaceId), {
      schema: z.array(policySchema),
    }),

  runs: (workspaceId: string) =>
    http.get<Run[]>(ESCALATION_ENDPOINTS.RUNS(workspaceId), { schema: z.array(runSchema) }),

  preview: (workspaceId: string, id: string) =>
    http.get<Preview[]>(ESCALATION_ENDPOINTS.PREVIEW(workspaceId, id), {
      schema: z.array(previewSchema),
    }),

  create: (workspaceId: string, body: PolicyRequest) =>
    http.post<Policy>(ESCALATION_ENDPOINTS.POLICIES(workspaceId), body, { schema: policySchema }),

  saveSimple: (workspaceId: string, body: SimplePolicyRequest) =>
    http.post<Policy>(ESCALATION_ENDPOINTS.SIMPLE(workspaceId), body, { schema: policySchema }),

  update: (workspaceId: string, id: string, body: Partial<PolicyRequest>) =>
    http.patch<Policy>(ESCALATION_ENDPOINTS.POLICY(workspaceId, id), body, {
      schema: policySchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(ESCALATION_ENDPOINTS.POLICY(workspaceId, id)),
}
