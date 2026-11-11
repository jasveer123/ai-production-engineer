import { z } from "zod"

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  severity: z.string(),
  source: z.string(),
  serviceId: z.string().nullable(),
  serviceName: z.string().nullable(),
  environment: z.string().nullable(),
  repositoryFullName: z.string().nullable(),
  eventCount: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  version: z.number(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type Incident = z.infer<typeof incidentSchema>

export const timelineEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  source: z.string(),
  kind: z.string(),
  summary: z.string().nullable().optional(),
  actorEmail: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  commitSha: z.string().optional(),
  version: z.string().nullable().optional(),
  environment: z.string().optional(),
})
export type TimelineEntry = z.infer<typeof timelineEntrySchema>

export const evidenceRefSchema = z.object({
  id: z.string(),
  ref: z.string(),
  kind: z.string(),
  title: z.string(),
  sourceReference: z.string(),
  sourceUrl: z.string().nullable(),
})
export type EvidenceRef = z.infer<typeof evidenceRefSchema>

export const hypothesisSchema = z.object({
  id: z.string(),
  rank: z.number(),
  summary: z.string(),
  confidence: z.string().nullable(),
  confidenceRationale: z.string().nullable(),
  supportingEvidence: z.array(z.string()),
  contradictingEvidence: z.array(z.string()),
  missingInformation: z.array(z.string()),
  suspectedLocation: z
    .object({ file: z.string(), line: z.number().nullable(), symbol: z.string().nullable() })
    .nullable(),
  feedback: z.object({ mine: z.string().nullable() }).passthrough(),
})
export type Hypothesis = z.infer<typeof hypothesisSchema>

export const investigationViewSchema = z.object({
  id: z.string(),
  attempt: z.number(),
  status: z.string(),
  statusReason: z.string().nullable(),
  model: z.string().nullable(),
  observations: z.array(z.object({ statement: z.string(), evidence: z.array(z.string()) })),
  dataGaps: z.array(z.string()),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  evidence: z.array(evidenceRefSchema),
  hypotheses: z.array(hypothesisSchema),
})
export type InvestigationView = z.infer<typeof investigationViewSchema>

export const incidentInvestigationSchema = z.object({
  latest: investigationViewSchema.nullable(),
  attempts: z.number(),
  workflow: z.object({ phase: z.string(), attempt: z.number() }).nullable(),
  reproductionApproved: z.boolean(),
})
export type IncidentInvestigation = z.infer<typeof incidentInvestigationSchema>

export const evidenceContentSchema = z.object({
  ref: z.string(),
  title: z.string(),
  content: z.string(),
})
export type EvidenceContent = z.infer<typeof evidenceContentSchema>

export const validationRunSchema = z.object({
  id: z.string(),
  kind: z.string(),
  attempt: z.number(),
  status: z.string(),
  durationMs: z.number().nullable(),
  createdAt: z.string(),
})
export type ValidationRun = z.infer<typeof validationRunSchema>

export const fixViewSchema = z.object({
  id: z.string(),
  version: z.number(),
  status: z.string(),
  statusReason: z.string().nullable(),
  repositoryFullName: z.string().nullable(),
  baseCommitSha: z.string(),
  testPath: z.string().nullable(),
  test: z.string().nullable(),
  testRationale: z.string().nullable(),
  diff: z.string().nullable(),
  explanation: z.string().nullable(),
  diffStat: z
    .object({ files: z.number(), additions: z.number(), deletions: z.number() })
    .nullable(),
  patchAttempts: z.number(),
  runs: z.array(validationRunSchema),
  createdAt: z.string(),
})
export type FixView = z.infer<typeof fixViewSchema>

export const pullRequestSchema = z.object({
  id: z.string(),
  incidentId: z.string().nullable(),
  incidentTitle: z.string().nullable(),
  repositoryFullName: z.string().nullable(),
  number: z.number().nullable(),
  url: z.string().nullable(),
  title: z.string().nullable(),
  branchName: z.string(),
  baseBranch: z.string().nullable(),
  status: z.string(),
  checksStatus: z.string(),
  checks: z.array(
    z.object({ name: z.string(), status: z.string(), conclusion: z.string().nullable() })
  ),
  approvedBy: z.string().nullable(),
  mergedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type PullRequest = z.infer<typeof pullRequestSchema>

export const incidentFixesSchema = z.object({
  latest: fixViewSchema.nullable(),
  versions: z.number(),
  phase: z.string().nullable(),
  pullRequest: pullRequestSchema.nullable(),
})
export type IncidentFixes = z.infer<typeof incidentFixesSchema>

export const verificationRunSchema = z.object({
  id: z.string(),
  window: z.number(),
  deployCommitSha: z.string(),
  deployVersion: z.string().nullable(),
  deployedAt: z.string().nullable(),
  status: z.string(),
  outcome: z.string().nullable(),
  reason: z.string().nullable(),
  baseline: z
    .object({ errors: z.number(), durationMs: z.number(), errorsPerHour: z.number() })
    .nullable(),
  observed: z
    .object({
      errors: z.number(),
      durationMs: z.number(),
      requests: z.number().nullable(),
      operation: z.string().nullable(),
      expectedErrors: z.number(),
    })
    .nullable(),
})
export type VerificationRun = z.infer<typeof verificationRunSchema>

export const incidentVerificationSchema = z.object({
  runs: z.array(verificationRunSchema),
  awaitingDeploy: z
    .object({ prNumber: z.number().nullable(), mergeCommitSha: z.string().nullable() })
    .nullable(),
  phase: z.string().nullable(),
})
export type IncidentVerification = z.infer<typeof incidentVerificationSchema>

export interface TransitionRequest {
  to: string
  expectedVersion: number
  reason?: string
}

export interface IncidentActionRequest {
  action: "investigate" | "approve_reproduction" | "dismiss"
  note?: string
}

export interface FixActionRequest {
  action: "regenerate" | "reject" | "approve_pr"
  note?: string
}

export interface FeedbackRequest {
  hypothesisId: string
  verdict: string
}
