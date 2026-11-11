import { z } from "zod"
import { INCIDENTS_ENDPOINTS, http } from "@/lib/api"
import { LIST_LIMIT } from "../constants"
import {
  evidenceContentSchema,
  incidentFixesSchema,
  incidentInvestigationSchema,
  incidentSchema,
  incidentVerificationSchema,
  pullRequestSchema,
  timelineEntrySchema,
  type EvidenceContent,
  type FeedbackRequest,
  type FixActionRequest,
  type Incident,
  type IncidentActionRequest,
  type IncidentFixes,
  type IncidentInvestigation,
  type IncidentVerification,
  type PullRequest,
  type TimelineEntry,
  type TransitionRequest,
} from "../schemas"

export const incidentsService = {
  list: (workspaceId: string, status: string, severity: string) =>
    http.get<Incident[]>(INCIDENTS_ENDPOINTS.LIST(workspaceId), {
      query: {
        limit: LIST_LIMIT,
        ...(status !== "all" ? { status } : {}),
        ...(severity ? { severity } : {}),
      },
      schema: z.array(incidentSchema),
    }),

  get: (workspaceId: string, id: string) =>
    http.get<Incident>(INCIDENTS_ENDPOINTS.ONE(workspaceId, id), { schema: incidentSchema }),

  timeline: (workspaceId: string, id: string) =>
    http.get<TimelineEntry[]>(INCIDENTS_ENDPOINTS.TIMELINE(workspaceId, id), {
      schema: z.array(timelineEntrySchema),
    }),

  acknowledge: (workspaceId: string, id: string) =>
    http.post<Incident>(
      INCIDENTS_ENDPOINTS.ACKNOWLEDGE(workspaceId, id),
      {},
      { schema: incidentSchema }
    ),

  transition: (workspaceId: string, id: string, body: TransitionRequest) =>
    http.post<Incident>(INCIDENTS_ENDPOINTS.TRANSITION(workspaceId, id), body, {
      schema: incidentSchema,
    }),

  investigation: (workspaceId: string, id: string) =>
    http.get<IncidentInvestigation>(INCIDENTS_ENDPOINTS.INVESTIGATION(workspaceId, id), {
      schema: incidentInvestigationSchema,
    }),

  evidence: (workspaceId: string, id: string, evidenceId: string) =>
    http.get<EvidenceContent>(INCIDENTS_ENDPOINTS.EVIDENCE(workspaceId, id, evidenceId), {
      schema: evidenceContentSchema,
    }),

  act: (workspaceId: string, id: string, body: IncidentActionRequest) =>
    http.post<IncidentInvestigation>(INCIDENTS_ENDPOINTS.ACTION(workspaceId, id), body, {
      schema: incidentInvestigationSchema,
    }),

  feedback: (workspaceId: string, id: string, body: FeedbackRequest) =>
    http.post<IncidentInvestigation>(INCIDENTS_ENDPOINTS.FEEDBACK(workspaceId, id), body, {
      schema: incidentInvestigationSchema,
    }),

  fixes: (workspaceId: string, id: string) =>
    http.get<IncidentFixes>(INCIDENTS_ENDPOINTS.FIXES(workspaceId, id), {
      schema: incidentFixesSchema,
    }),

  fixAction: (workspaceId: string, id: string, body: FixActionRequest) =>
    http.post<IncidentFixes>(INCIDENTS_ENDPOINTS.FIX_ACTION(workspaceId, id), body, {
      schema: incidentFixesSchema,
    }),

  verification: (workspaceId: string, id: string) =>
    http.get<IncidentVerification>(INCIDENTS_ENDPOINTS.VERIFICATION(workspaceId, id), {
      schema: incidentVerificationSchema,
    }),

  pullRequests: (workspaceId: string) =>
    http.get<PullRequest[]>(INCIDENTS_ENDPOINTS.PULL_REQUESTS(workspaceId), {
      schema: z.array(pullRequestSchema),
    }),

  syncPullRequest: (workspaceId: string, id: string) =>
    http.post<PullRequest>(INCIDENTS_ENDPOINTS.SYNC_PULL_REQUEST(workspaceId, id), undefined, {
      schema: pullRequestSchema,
    }),
}
