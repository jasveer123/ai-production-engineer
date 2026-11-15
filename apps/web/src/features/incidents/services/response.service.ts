import { z } from "zod"
import { ESCALATION_ENDPOINTS, INCIDENTS_ENDPOINTS, SETTINGS_ENDPOINTS, http } from "@/lib/api"
import {
  activityPageSchema,
  incidentContextSchema,
  memberOptionSchema,
  policyOptionSchema,
  type ActivityPage,
  type IncidentContext,
  type IncidentListFilters,
  type IncidentUpdate,
  type MemberOption,
  type PolicyOption,
  type ReportIncidentRequest,
  type ResponseRequest,
} from "../response-schemas"
import { incidentSchema, type Incident } from "../schemas"

export const LIST_PAGE_SIZE = 25

function listQuery(filters: IncidentListFilters) {
  const entries = Object.entries({
    state: filters.state === "all" ? "" : filters.state,
    severity: filters.severity,
    monitorId: filters.monitorId,
    q: filters.q.trim(),
    from: filters.from ? new Date(filters.from).toISOString() : "",
    to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : "",
  }).filter(([, value]) => value)
  return { ...Object.fromEntries(entries), limit: LIST_PAGE_SIZE, offset: filters.offset }
}

export const responseService = {
  list: (workspaceId: string, filters: IncidentListFilters) =>
    http.get<Incident[]>(INCIDENTS_ENDPOINTS.LIST(workspaceId), {
      query: listQuery(filters),
      schema: z.array(incidentSchema),
    }),

  report: (workspaceId: string, body: ReportIncidentRequest) =>
    http.post<Incident>(INCIDENTS_ENDPOINTS.LIST(workspaceId), body, { schema: incidentSchema }),

  respond: (workspaceId: string, id: string, { action, ...body }: ResponseRequest) =>
    http.post<Incident>(INCIDENTS_ENDPOINTS.RESPOND(workspaceId, id, action), body, {
      schema: incidentSchema,
    }),

  escalate: (workspaceId: string, id: string, policyId?: string) =>
    http.post<Incident>(
      INCIDENTS_ENDPOINTS.RESPOND(workspaceId, id, "escalate"),
      policyId ? { policyId } : {},
      { schema: incidentSchema }
    ),

  update: (workspaceId: string, id: string, body: IncidentUpdate) =>
    http.patch<Incident>(INCIDENTS_ENDPOINTS.ONE(workspaceId, id), body, {
      schema: incidentSchema,
    }),

  remove: (workspaceId: string, id: string) =>
    http.delete<void>(INCIDENTS_ENDPOINTS.ONE(workspaceId, id)),

  activity: (workspaceId: string, id: string, after?: string) =>
    http.get<ActivityPage>(INCIDENTS_ENDPOINTS.ACTIVITY(workspaceId, id), {
      query: { limit: 100, ...(after ? { after } : {}) },
      schema: activityPageSchema,
    }),

  context: (workspaceId: string, id: string) =>
    http.get<IncidentContext>(INCIDENTS_ENDPOINTS.CONTEXT(workspaceId, id), {
      schema: incidentContextSchema,
    }),

  comment: (workspaceId: string, id: string, body: string) =>
    http.post<{ id: string }>(INCIDENTS_ENDPOINTS.COMMENTS(workspaceId, id), { body }),

  editComment: (workspaceId: string, id: string, commentId: string, body: string) =>
    http.patch<void>(INCIDENTS_ENDPOINTS.COMMENT(workspaceId, id, commentId), { body }),

  deleteComment: (workspaceId: string, id: string, commentId: string) =>
    http.delete<void>(INCIDENTS_ENDPOINTS.COMMENT(workspaceId, id, commentId)),

  postMortem: (workspaceId: string, id: string, body: string) =>
    http.put<Incident>(
      INCIDENTS_ENDPOINTS.POST_MORTEM(workspaceId, id),
      { body },
      {
        schema: incidentSchema,
      }
    ),

  metadata: (workspaceId: string, id: string, metadata: Record<string, string>) =>
    http.put<Incident>(
      INCIDENTS_ENDPOINTS.METADATA(workspaceId, id),
      { metadata },
      {
        schema: incidentSchema,
      }
    ),

  policies: (workspaceId: string) =>
    http.get<PolicyOption[]>(ESCALATION_ENDPOINTS.POLICIES(workspaceId), {
      schema: z.array(policyOptionSchema),
    }),

  members: (workspaceId: string) =>
    http.get<MemberOption[]>(SETTINGS_ENDPOINTS.MEMBERS(workspaceId), {
      schema: z.array(memberOptionSchema),
    }),
}
