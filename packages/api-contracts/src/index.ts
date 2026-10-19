import { z } from 'zod';

// Shared by the API (validation) and the web app (forms and typed responses).

export const ROLES = ['owner', 'admin', 'engineer', 'viewer'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ----- Auth -----
export const devLoginSchema = z.object({ email: z.string().email() });
export type DevLoginInput = z.infer<typeof devLoginSchema>;

export interface Me {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  workspaces: { id: string; name: string; role: Role }[];
  authProviders: { github: boolean; devLogin: boolean };
}

// ----- Workspaces -----
export const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(80) });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  status: string;
  role: Role;
}

// ----- Members & invitations -----
export const inviteMemberSchema = z.object({ email: z.string().email(), role: roleSchema });
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({ role: roleSchema });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface Member {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

// ----- Services -----
const repoFullName = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo');

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  environment: z.string().trim().min(1).max(40),
  repositoryFullName: repoFullName.nullable().optional(),
  defaultBranch: z.string().trim().min(1).max(100).default('main'),
});
export type CreateServiceInput = z.input<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.input<typeof updateServiceSchema>;

export interface Service {
  id: string;
  name: string;
  environment: string;
  repositoryFullName: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Audit -----
export const auditQuerySchema = z.object({
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  outcome: z.enum(['success', 'denied', 'failure']).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.input<typeof auditQuerySchema>;

export interface AuditEvent {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'success' | 'denied' | 'failure';
  correlationId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

// ----- Incidents -----
export const INCIDENT_STATUSES = [
  'detected',
  'investigating',
  'fix_proposed',
  'validation',
  'awaiting_review',
  'monitoring',
  'resolved',
  'needs_attention',
  'closed_without_fix',
  'validation_failed',
  'verification_inconclusive',
] as const;
export const incidentStatusSchema = z.enum(INCIDENT_STATUSES);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const severitySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof severitySchema>;

/** Closed incidents. A recurrence of the same fingerprint opens a new incident. */
export const CLOSED_STATUSES: readonly IncidentStatus[] = ['resolved', 'closed_without_fix'];

/** The incident state machine (FRD FR-05). The API rejects any transition not listed here. */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  detected: ['investigating', 'needs_attention', 'closed_without_fix'],
  investigating: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  fix_proposed: ['validation', 'needs_attention', 'closed_without_fix'],
  validation: ['awaiting_review', 'validation_failed'],
  validation_failed: ['fix_proposed', 'needs_attention', 'closed_without_fix'],
  awaiting_review: ['monitoring', 'fix_proposed', 'closed_without_fix'],
  monitoring: ['resolved', 'needs_attention', 'verification_inconclusive'],
  verification_inconclusive: ['monitoring', 'resolved', 'needs_attention'],
  needs_attention: ['investigating', 'resolved', 'closed_without_fix'],
  resolved: ['needs_attention'],
  closed_without_fix: ['needs_attention'],
};

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: IncidentStatus;
  severity: Severity;
  source: string;
  serviceId: string | null;
  serviceName: string | null;
  environment: string | null;
  /** The mapped service's repository, or null when the telemetry service is not mapped yet. */
  repositoryFullName: string | null;
  fingerprint: string;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  version: number;
  createdAt: string;
}

export const incidentListQuerySchema = z.object({
  status: z.union([incidentStatusSchema, z.literal('open'), z.literal('closed')]).optional(),
  severity: severitySchema.optional(),
  serviceId: z.string().uuid().optional(),
  environment: z.string().max(40).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type IncidentListQuery = z.input<typeof incidentListQuerySchema>;

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  severity: severitySchema.default('medium'),
  serviceId: z.string().uuid().optional(),
});
export type CreateIncidentInput = z.input<typeof createIncidentSchema>;

export const transitionIncidentSchema = z.object({
  to: incidentStatusSchema,
  reason: z.string().trim().max(1000).optional(),
  /** Optimistic concurrency: the incident version the user was looking at. */
  expectedVersion: z.number().int().positive(),
});
export type TransitionIncidentInput = z.infer<typeof transitionIncidentSchema>;

export type TimelineEntry =
  | {
      kind: 'error' | 'created' | 'status_change' | 'investigation';
      id: string;
      at: string;
      source: string;
      summary: string | null;
      traceId: string | null;
      sourceUrl: string | null;
      actorEmail: string | null;
      attributes: Record<string, unknown>;
    }
  | {
      kind: 'deploy';
      id: string;
      at: string;
      source: string;
      summary: string;
      commitSha: string;
      version: string | null;
      environment: string;
    };

// ----- Integrations -----
export const INTEGRATION_PROVIDERS = ['deploy_webhook', 'otel_jaeger', 'github'] as const;
export const integrationProviderSchema = z.enum(INTEGRATION_PROVIDERS);
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;

export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  name: z.string().trim().min(1).max(80),
});
export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

export interface Integration {
  id: string;
  provider: string;
  name: string;
  status: 'pending' | 'connected' | 'error' | 'disconnected';
  /** What the platform is allowed to do with this integration. */
  scope: string;
  lastSyncAt: string | null;
  lastError: string | null;
  webhookUrl: string | null;
  createdAt: string;
}

/** Returned once on creation or secret rotation. The secret is never shown again. */
export interface IntegrationWithSecret extends Integration {
  signingSecret: string | null;
}

export interface DeadLetter {
  id: string;
  integrationId: string;
  source: string;
  externalEventId: string;
  attempts: number;
  deadReason: string | null;
  lastError: string | null;
  receivedAt: string;
}

// ----- Workspace settings -----
export const severityRuleSchema = z.object({
  environment: z.string().max(40).optional(),
  serviceName: z.string().max(100).optional(),
  errorType: z.string().max(200).optional(),
  severity: severitySchema,
});
export const severityRulesSchema = z.object({ rules: z.array(severityRuleSchema).max(50) });
export type SeverityRule = z.infer<typeof severityRuleSchema>;

// ----- GitHub -----
export interface GitHubAppInfo {
  configured: boolean;
  slug: string | null;
  installUrl: string | null;
  /** Installations of the App that are not yet connected to any workspace. */
  installations: { id: number; account: string; repositorySelection: 'all' | 'selected' }[];
}

export const connectGitHubSchema = z.object({
  installationId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).default('GitHub'),
});
export type ConnectGitHubInput = z.input<typeof connectGitHubSchema>;

export interface RepositoryAccess {
  repositoryFullName: string;
  accessible: boolean;
  integrationId: string | null;
}

export interface RepoCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
  url: string;
}

// ----- Investigations (Phase 4) -----
export type InvestigationStatus =
  'collecting_evidence' | 'analyzing' | 'completed' | 'needs_review' | 'failed' | 'cancelled';

export interface EvidenceRef {
  id: string;
  ref: string;
  kind: 'error_event' | 'trace' | 'deploy' | 'code' | 'commit';
  title: string;
  sourceReference: string;
  sourceUrl: string | null;
}

export interface HypothesisView {
  id: string;
  rank: number;
  summary: string;
  confidence: 'high' | 'medium' | 'low' | null;
  confidenceRationale: string | null;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInformation: string[];
  suspectedLocation: { file: string; line: number | null; symbol: string | null } | null;
}

export interface InvestigationView {
  id: string;
  attempt: number;
  status: InvestigationStatus;
  statusReason: string | null;
  model: string | null;
  promptVersion: string | null;
  coverage: Record<string, string | number>;
  observations: { statement: string; evidence: string[] }[];
  dataGaps: string[];
  rejectedCount: number;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
    latency_ms?: number;
    calls?: number;
  };
  requestNote: string | null;
  startedAt: string | null;
  completedAt: string | null;
  evidence: EvidenceRef[];
  hypotheses: HypothesisView[];
}

export interface IncidentInvestigation {
  /** Latest attempt first; null when no investigation has started yet. */
  latest: InvestigationView | null;
  attempts: number;
  workflow: { phase: string; attempt: number } | null;
  reproductionApproved: boolean;
}

export const INCIDENT_ACTIONS = ['investigate', 'approve_reproduction', 'dismiss'] as const;
export const incidentActionSchema = z.object({
  action: z.enum(INCIDENT_ACTIONS),
  note: z.string().trim().max(2000).optional(),
});
export type IncidentActionInput = z.infer<typeof incidentActionSchema>;
