import { z } from "zod"
import { ESCALATION_ENDPOINTS, http } from "@/lib/api"
import { policySchema, runSchema, type Policy, type PolicyRequest, type Run } from "../schemas"

export const escalationService = {
  policies: (workspaceId: string) =>
    http.get<Policy[]>(ESCALATION_ENDPOINTS.POLICIES(workspaceId), {
      schema: z.array(policySchema),
    }),

  runs: (workspaceId: string) =>
    http.get<Run[]>(ESCALATION_ENDPOINTS.RUNS(workspaceId), { schema: z.array(runSchema) }),

  create: (workspaceId: string, body: PolicyRequest) =>
    http.post<Policy>(ESCALATION_ENDPOINTS.POLICIES(workspaceId), body, { schema: policySchema }),

  update: (workspaceId: string, id: string, body: Partial<PolicyRequest>) =>
    http.patch<Policy>(ESCALATION_ENDPOINTS.POLICY(workspaceId, id), body, {
      schema: policySchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(ESCALATION_ENDPOINTS.POLICY(workspaceId, id)),
}
