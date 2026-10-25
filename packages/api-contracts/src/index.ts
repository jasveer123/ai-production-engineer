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

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`);
const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: emailSchema,
  password: passwordSchema,
  /** From an invite link: proves the email and joins that workspace. */
  inviteToken: z.string().min(20).max(200).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(PASSWORD_MAX).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export type TokenInput = z.infer<typeof tokenSchema>;

export const updateProfileSchema = z.object({ name: z.string().trim().min(1).max(100) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface Me {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    hasPassword: boolean;
  };
  workspaces: { id: string; name: string; role: Role }[];
  authProviders: { password: boolean; github: boolean; devLogin: boolean };
}

/** What an invite link points at, shown before the invitee registers or signs in. */
export interface InvitationPreview {
  email: string;
  role: Role;
  workspaceName: string;
  invitedBy: string | null;
  /** True when an account with this email already exists: sign in instead of registering. */
  accountExists: boolean;
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
  expiresAt: string | null;
}

/** Returned once when an invitation is created or re-sent. The link is never shown again. */
export interface InvitationWithLink extends Invitation {
  inviteUrl: string;
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

/** A service name seen in this workspace's telemetry that has no service mapping yet (FR-03). */
export interface DiscoveredService {
  name: string;
  environment: string;
  lastReceivedAt: string;
}

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
      kind:
        'error' | 'created' | 'status_change' | 'investigation' | 'fix' | 'verification' | 'alert';
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
  /** Includes a signed state, so GitHub's redirect back connects to this workspace. */
  installUrl: string | null;
  /** Installations of the App that are not yet connected to any workspace. */
  installations: { id: number; account: string; repositorySelection: 'all' | 'selected' }[];
  /**
   * Installations already connected to another workspace. The workspace is named only when the
   * caller is a member of it (otherwise null), so this does not reveal other tenants.
   */
  connectedElsewhere: {
    id: number;
    account: string;
    workspaceId: string | null;
    workspaceName: string | null;
  }[];
}

export const connectGitHubSchema = z.object({
  installationId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80).default('GitHub'),
  /** Repositories this workspace may use. Omit to grant every repo the App installation can see. */
  repositories: z
    .array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo'))
    .min(1)
    .max(100)
    .optional(),
});
export type ConnectGitHubInput = z.input<typeof connectGitHubSchema>;

export interface GitHubSelectRepo {
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

/** GitHub accounts this workspace can connect, with the repositories each installation granted. */
export interface GitHubSelectView {
  configured: boolean;
  installUrl: string | null;
  accounts: {
    installationId: number;
    account: string;
    accountType: string | null;
    avatarUrl: string;
    repositorySelection: 'all' | 'selected';
    repositories: GitHubSelectRepo[];
    /** Already chosen for this workspace; all granted repos when not yet connected here. */
    selected: string[];
    connected: boolean;
    /** This workspace's connection for the account, so it can be disconnected; null when not connected. */
    integrationId: string | null;
  }[];
}

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
  kind: 'error_event' | 'alert' | 'trace' | 'log' | 'deploy' | 'code' | 'commit';
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
  /** Engineers' verdicts (Phase 9). `mine` is the caller's own verdict. */
  feedback: { correct: number; partly: number; wrong: number; mine: HypothesisVerdict | null };
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

// ----- Fixes (Phase 5) -----
export interface ValidationRunView {
  id: string;
  kind: 'baseline' | 'reproduction' | 'regression' | 'full_suite' | 'policy';
  attempt: number;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  durationMs: number | null;
  summary: Record<string, unknown>;
  createdAt: string;
}

export interface FixView {
  id: string;
  version: number;
  status: string;
  statusReason: string | null;
  repositoryFullName: string | null;
  baseCommitSha: string;
  testPath: string | null;
  test: string | null;
  testRationale: string | null;
  diff: string | null;
  explanation: string | null;
  diffStat: { files: number; additions: number; deletions: number } | null;
  patchAttempts: number;
  runs: ValidationRunView[];
  createdAt: string;
}

export interface PullRequestView {
  id: string;
  incidentId: string | null;
  incidentTitle: string | null;
  fixProposalId: string | null;
  repositoryFullName: string | null;
  number: number | null;
  url: string | null;
  title: string | null;
  branchName: string;
  baseBranch: string | null;
  status: 'open' | 'merged' | 'closed';
  checksStatus: 'pending' | 'passing' | 'failing' | 'none';
  checks: { name: string; status: string; conclusion: string | null }[];
  approvedBy: string | null;
  mergedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface IncidentFixes {
  latest: FixView | null;
  versions: number;
  phase: string | null;
  pullRequest: PullRequestView | null;
}

// ----- Recovery verification (Phase 7) -----
/** Traffic counts stop at this many traces: enough to decide, cheap to query. */
export const TRAFFIC_COUNT_CAP = 1000;

export interface VerificationRunView {
  id: string;
  window: number;
  deployCommitSha: string;
  deployVersion: string | null;
  deployedAt: string | null;
  status: 'observing' | 'completed';
  outcome: 'recovered' | 'not_recovered' | 'inconclusive' | null;
  reason: string | null;
  baseline: { errors: number; durationMs: number; errorsPerHour: number } | null;
  observed: {
    errors: number;
    durationMs: number;
    requests: number | null;
    operation: string | null;
    expectedErrors: number;
  } | null;
  windowStartedAt: string | null;
  windowEndedAt: string | null;
}

export interface IncidentVerification {
  /** Latest window first. */
  runs: VerificationRunView[];
  /** The merged fix the platform is waiting to see deployed, if any. */
  awaitingDeploy: { prNumber: number | null; mergeCommitSha: string | null } | null;
  phase: string | null;
}

export const FIX_ACTIONS = ['regenerate', 'reject', 'approve_pr'] as const;
export const fixActionSchema = z.object({
  action: z.enum(FIX_ACTIONS),
  note: z.string().trim().max(2000).optional(),
});
export type FixActionInput = z.infer<typeof fixActionSchema>;

// ----- Real-time updates (Phase 8) -----
/** One SSE `change` message: what changed, never the data itself. Clients re-read via the API. */
export interface LiveChange {
  table: string;
  incidentId: string | null;
}

// ----- Notifications (Phase 8) -----
export const NOTIFICATION_EVENTS = [
  'incident.detected',
  'review.requested',
  'incident.needs_attention',
  'incident.resolved',
  'verification.inconclusive',
] as const;
export const notificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof notificationEventSchema>;

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  'incident.detected': 'New incident detected',
  'review.requested': 'Validated fix waiting for review',
  'incident.needs_attention': 'Incident needs attention (e.g. the fix did not work)',
  'incident.resolved': 'Incident resolved (recovery verified)',
  'verification.inconclusive': 'Recovery could not be verified',
};

const channelEvents = z.array(notificationEventSchema).min(1).max(NOTIFICATION_EVENTS.length);
const channelName = z.string().trim().min(1).max(80);

export const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/;

export const createNotificationChannelSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('slack'),
    name: channelName,
    webhookUrl: z
      .string()
      .regex(
        SLACK_WEBHOOK_PATTERN,
        'Use a Slack incoming webhook URL (https://hooks.slack.com/services/…)',
      ),
    events: channelEvents,
    minSeverity: severitySchema.default('low'),
  }),
  z.object({
    kind: z.literal('webhook'),
    name: channelName,
    url: z.string().url().max(500),
    events: channelEvents,
    minSeverity: severitySchema.default('low'),
  }),
]);
export type CreateNotificationChannelInput = z.input<typeof createNotificationChannelSchema>;

export const updateNotificationChannelSchema = z.object({
  name: channelName.optional(),
  events: channelEvents.optional(),
  minSeverity: severitySchema.optional(),
  enabled: z.boolean().optional(),
});
export type UpdateNotificationChannelInput = z.infer<typeof updateNotificationChannelSchema>;

export interface NotificationChannel {
  id: string;
  kind: 'slack' | 'webhook';
  name: string;
  /** Where messages go, with any credential in the URL masked. */
  target: string;
  events: NotificationEvent[];
  minSeverity: Severity;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastError: string | null;
  createdAt: string;
}

/** Returned once on creation. Receivers verify `x-ape-signature` with this secret. */
export interface NotificationChannelWithSecret extends NotificationChannel {
  signingSecret: string | null;
}

export interface NotificationDelivery {
  id: string;
  channelId: string;
  channelName: string;
  eventType: string;
  incidentId: string | null;
  status: 'sent' | 'failed';
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface NotificationTestResult {
  ok: boolean;
  status: number | null;
  error: string | null;
}

// ----- Approval policy (Phase 8 settings) -----
export const approvalPolicySchema = z.object({
  /** Lowest role allowed to approve opening a pull request. */
  prMinRole: z.enum(['owner', 'admin', 'engineer']),
});
export type ApprovalPolicyInput = z.infer<typeof approvalPolicySchema>;

// ----- Quality: feedback and evaluation (Phase 9) -----
export const HYPOTHESIS_VERDICTS = ['correct', 'partly', 'wrong'] as const;
export type HypothesisVerdict = (typeof HYPOTHESIS_VERDICTS)[number];

export const hypothesisFeedbackSchema = z.object({
  hypothesisId: z.string().uuid(),
  verdict: z.enum(HYPOTHESIS_VERDICTS),
  note: z.string().trim().max(1000).optional(),
});
export type HypothesisFeedbackInput = z.infer<typeof hypothesisFeedbackSchema>;

export const qualityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/** How well the platform did in production over a window, from real outcomes. */
export interface QualitySummary {
  days: number;
  /** Each stage counts incidents that reached it. */
  funnel: {
    incidents: number;
    investigated: number;
    fixValidated: number;
    prMerged: number;
    recovered: number;
  };
  investigations: {
    runs: number;
    completed: number;
    needsReview: number;
    failed: number;
    guardRejections: number;
    costUsd: number;
    avgLatencyMs: number | null;
  };
  models: {
    model: string;
    runs: number;
    completed: number;
    costUsd: number;
    avgLatencyMs: number | null;
    top1Rated: number;
    top1Correct: number;
  }[];
  /** Verdicts on hypothesis #1. Precision counts "partly" as half. */
  feedback: {
    rated: number;
    correct: number;
    partly: number;
    wrong: number;
    top1Precision: number | null;
  };
  fixes: { total: number; validated: number; validationFailed: number; notReproduced: number };
  /** Final verification outcome per incident. */
  verification: { recovered: number; notRecovered: number; inconclusive: number };
}

// ----- Alerts (Phase 10) -----
export const ALERT_SOURCE_KINDS = [
  'http',
  'alertmanager',
  'grafana',
  'sentry',
  'datadog',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
  'heartbeat',
] as const;
export type AlertSourceKind = (typeof ALERT_SOURCE_KINDS)[number];

export const ALERT_SOURCE_LABELS: Record<AlertSourceKind, string> = {
  http: 'HTTP (JSON)',
  alertmanager: 'Prometheus Alertmanager',
  grafana: 'Grafana alerting',
  sentry: 'Sentry',
  datadog: 'Datadog',
  betterstack: 'Better Stack',
  cloudwatch: 'Amazon CloudWatch (SNS)',
  elasticsearch: 'Elasticsearch / Kibana',
  heartbeat: 'Heartbeat monitor',
};

export const createAlertSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum([
      'http',
      'alertmanager',
      'grafana',
      'sentry',
      'datadog',
      'betterstack',
      'cloudwatch',
      'elasticsearch',
    ]),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    kind: z.literal('heartbeat'),
    name: z.string().trim().min(1).max(80),
    /** Expected time between pings. */
    intervalSeconds: z
      .number()
      .int()
      .min(30)
      .max(7 * 24 * 3600),
    /** Extra time allowed before the heartbeat counts as missed. */
    graceSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 3600)
      .default(60),
  }),
]);
export type CreateAlertSourceInput = z.input<typeof createAlertSourceSchema>;

export interface AlertSource {
  id: string;
  kind: AlertSourceKind;
  name: string;
  status: 'pending' | 'connected' | 'error' | 'disconnected';
  /** Where the tool sends alerts (or pings, for heartbeats). Authenticate with the token. */
  url: string;
  lastReceivedAt: string | null;
  lastError: string | null;
  heartbeat: {
    intervalSeconds: number;
    graceSeconds: number;
    state: 'pending' | 'up' | 'down';
    lastPingAt: string | null;
  } | null;
  createdAt: string;
}

/** Returned once on creation or rotation. Send as `Authorization: Bearer <token>` or `?token=`. */
export interface AlertSourceWithToken extends AlertSource {
  token: string;
}

export const ALERT_CONDITION_OPS = [
  'eq',
  'neq',
  'contains',
  'not_contains',
  'regex',
  'exists',
  'not_exists',
] as const;

export const alertConditionSchema = z
  .object({
    field: z
      .string()
      .regex(
        /^(title|description|severity|status|label\.[A-Za-z0-9_.\-/]{1,100})$/,
        'Use title, description, severity, status or label.<name>',
      ),
    op: z.enum(ALERT_CONDITION_OPS),
    value: z.string().max(200).optional(),
  })
  .refine((c) => c.op === 'exists' || c.op === 'not_exists' || c.value !== undefined, {
    message: 'This operator needs a value',
  })
  .refine(
    (c) => {
      if (c.op !== 'regex') return true;
      try {
        new RegExp(c.value ?? '');
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Not a valid regular expression' },
  );
export type AlertCondition = z.infer<typeof alertConditionSchema>;

export const alertRouteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  sourceIds: z.array(z.string().uuid()).max(50).default([]),
  conditions: z.array(alertConditionSchema).max(20).default([]),
  groupBy: z.array(z.string().trim().min(1).max(100)).max(5).default([]),
  createIncident: z.boolean().default(true),
  incidentSeverity: severitySchema.nullable().default(null),
});
export type AlertRouteInput = z.input<typeof alertRouteSchema>;
export const updateAlertRouteSchema = alertRouteSchema.partial();
export const reorderAlertRoutesSchema = z.object({ ids: z.array(z.string().uuid()).max(200) });

export interface AlertRoute {
  id: string;
  name: string;
  position: number;
  enabled: boolean;
  sourceIds: string[];
  conditions: AlertCondition[];
  groupBy: string[];
  createIncident: boolean;
  incidentSeverity: Severity | null;
  createdAt: string;
}

export const alertPreviewSchema = z.object({
  sourceId: z.string().uuid(),
  payload: z.unknown(),
});

/** Dry run of a payload: what would be parsed and where each alert would go. */
export interface AlertPreview {
  alerts: {
    title: string;
    status: 'firing' | 'resolved';
    severity: Severity;
    dedupKey: string;
    labels: Record<string, string>;
    route: { id: string; name: string } | null;
    groupKey: string | null;
    createsIncident: boolean;
  }[];
  error: string | null;
}

export interface AlertView {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKind: AlertSourceKind;
  routeId: string | null;
  routeName: string | null;
  incidentId: string | null;
  incidentTitle: string | null;
  status: 'firing' | 'resolved';
  title: string;
  description: string | null;
  severity: Severity;
  labels: Record<string, string>;
  sourceUrl: string | null;
  occurrences: number;
  firstFiredAt: string;
  lastFiredAt: string;
  resolvedAt: string | null;
}

export const alertListQuerySchema = z.object({
  status: z.enum(['firing', 'resolved']).optional(),
  sourceId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type AlertListQuery = z.input<typeof alertListQuerySchema>;

// ----- Telemetry ingest (Ways 1-5) -----
export const INGEST_WAYS = ['package', 'otlp', 'http', 'agent', 'drain'] as const;
export type IngestWay = (typeof INGEST_WAYS)[number] | 'syslog';

export const createIngestTokenSchema = z.object({ name: z.string().trim().min(1).max(80) });
export type CreateIngestTokenInput = z.infer<typeof createIngestTokenSchema>;

export interface IngestToken {
  id: string;
  name: string;
  /** `ape_live_••••abcd`: the full token is only returned once. */
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface IngestTokenWithSecret extends IngestToken {
  token: string;
}

export type StreamState = 'receiving' | 'silent' | 'not_set_up';

export interface IngestStream {
  way: IngestWay;
  serviceName: string;
  environment: string;
  host: string | null;
  state: StreamState;
  firstReceivedAt: string;
  lastReceivedAt: string;
  logCount: number;
  spanCount: number;
  errorCount: number;
  metricCount: number;
}

export interface IngestOverview {
  /** Base URL for every way, e.g. https://ingest.example.com (OTLP appends /v1/...). */
  ingestUrl: string;
  syslog: { host: string; port: number; tls: boolean } | null;
  tokens: IngestToken[];
  ways: { way: IngestWay; state: StreamState; lastReceivedAt: string | null }[];
  streams: IngestStream[];
}

// ----- Logs -----
export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const logQuerySchema = z.object({
  /** `level:error service:x env:prod trace:abc host:h "exact phrase" words` */
  q: z.string().max(500).default(''),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** Id of the last line of the previous page (newest first). */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type LogQuery = z.input<typeof logQuerySchema>;

export interface LogLine {
  id: number;
  ts: string;
  service: string;
  environment: string;
  level: LogLevel;
  message: string;
  attributes: Record<string, unknown>;
  traceId: string | null;
  spanId: string | null;
  host: string | null;
  way: IngestWay;
}

export interface LogSearchResult {
  lines: LogLine[];
  /** Counts per bucket over [from, to], oldest first. */
  histogram: { at: string; total: number; errors: number }[];
  nextBefore: number | null;
  services: string[];
}

// ----- Connected tools (Ways 6-7) -----
export const TOOL_IDS = [
  'grafana',
  'datadog',
  'sentry',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

const httpsUrl = z.string().trim().url().max(500);
const secret = z.string().trim().min(1).max(4000);

/** Read-only credentials per tool. Secrets are stored encrypted and never returned. */
export const connectReaderSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    /** Loki base URL, or Grafana URL + datasource proxy path. */
    url: httpsUrl,
    auth: z.enum(['bearer', 'basic']).default('bearer'),
    username: z.string().trim().max(200).optional(),
    token: secret,
    orgId: z.string().trim().max(100).optional(),
    /** Label that holds the service name, e.g. `service_name` or `app`. */
    serviceLabel: z.string().trim().min(1).max(100).default('service_name'),
  }),
  z.object({
    tool: z.literal('datadog'),
    site: z
      .enum([
        'datadoghq.com',
        'us3.datadoghq.com',
        'us5.datadoghq.com',
        'datadoghq.eu',
        'ap1.datadoghq.com',
        'ddog-gov.com',
      ])
      .default('datadoghq.com'),
    apiKey: secret,
    appKey: secret,
  }),
  z.object({
    tool: z.literal('sentry'),
    url: httpsUrl.default('https://sentry.io'),
    organization: z.string().trim().min(1).max(100),
    token: secret,
  }),
  z.object({
    tool: z.literal('betterstack'),
    /** "Connect remotely" ClickHouse HTTP endpoint. */
    url: httpsUrl,
    username: z.string().trim().min(1).max(200),
    password: secret,
    /** Source table, e.g. `t123456_myapp_logs`. */
    table: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]+$/, 'Letters, digits and _ only')
      .max(200),
  }),
  z.object({
    tool: z.literal('cloudwatch'),
    region: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(-[a-z]+)+-\d$/, 'e.g. eu-west-1'),
    accessKeyId: z.string().trim().min(16).max(128),
    secretAccessKey: secret,
    /** Log groups to search, comma separated. */
    logGroups: z.array(z.string().trim().min(1).max(512)).min(1).max(20),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: httpsUrl,
    auth: z.enum(['apikey', 'basic']).default('apikey'),
    username: z.string().trim().max(200).optional(),
    token: secret,
    index: z.string().trim().min(1).max(200).default('logs-*'),
    serviceField: z.string().trim().min(1).max(100).default('service.name'),
  }),
]);
export type ConnectReaderInput = z.input<typeof connectReaderSchema>;

export interface ToolView {
  id: ToolId;
  name: string;
  description: string;
  /** What Way 7 reads from this tool, e.g. "Loki logs". */
  readsWhat: string;
  alerts: {
    enabled: boolean;
    sourceId: string | null;
    url: string | null;
    lastReceivedAt: string | null;
    lastError: string | null;
  };
  reader: {
    status: 'not_connected' | 'connected' | 'error';
    /** Non-secret settings, e.g. URL and organization. */
    settings: Record<string, string>;
    lastUsedAt: string | null;
    lastError: string | null;
  };
}

/** Turning alerts on returns the source token once, with setup text for that tool. */
export interface ToolAlertsEnabled {
  tool: ToolView;
  token: string | null;
  url: string;
  setup: string;
}

export const toolAlertsSchema = z.object({ enabled: z.boolean() });
export type ToolAlertsInput = z.infer<typeof toolAlertsSchema>;

/** Logs from a connected tool, normalized; used by the AI and by "Test connection". */
export interface ReaderLogLine {
  ts: string;
  level: string;
  message: string;
  service: string | null;
  url: string | null;
}

// ----- One-click setup (ADR-024) -----
export interface SetupCapabilities {
  github: { configured: boolean };
  /** "Sign in and approve" flows that are configured on this server. */
  oauth: { sentry: boolean; vercel: boolean; heroku: boolean };
  /** Base URL other tools send to. Cloud tools cannot reach localhost. */
  publicUrl: string;
  publicUrlIsLocal: boolean;
  agent: { scriptUrl: string; kubernetesUrl: string };
  syslog: { host: string; port: number; tls: boolean } | null;
}

const serviceName = z
  .string()
  .trim()
  .min(1, 'Enter the service name')
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only');

export const setupPrSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo'),
  kind: z.enum(['agent', 'deploy']),
  service: serviceName,
  environment: z.string().trim().min(1).max(40).default('production'),
  /** App folder inside a monorepo, e.g. "services/api". Detected when empty. */
  directory: z.string().trim().max(200).optional(),
});
export type SetupPrInput = z.input<typeof setupPrSchema>;

export interface SetupPrResult {
  url: string;
  number: number;
  draft: boolean;
  /** The pull request already existed from an earlier run. */
  existing: boolean;
  language: 'node' | 'python' | null;
  done: string[];
  todo: string[];
}

export const autoSetupSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    url: z.string().trim().url(),
    token: z.string().trim().min(1).max(4000),
    serviceLabel: z.string().trim().max(100).optional(),
  }),
  z.object({
    tool: z.literal('datadog'),
    site: z
      .enum([
        'datadoghq.com',
        'us3.datadoghq.com',
        'us5.datadoghq.com',
        'datadoghq.eu',
        'ap1.datadoghq.com',
        'ddog-gov.com',
      ])
      .default('datadoghq.com'),
    apiKey: z.string().trim().min(1).max(200),
    appKey: z.string().trim().min(1).max(200),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: z.string().trim().url(),
    kibanaUrl: z.string().trim().url().optional(),
    adminApiKey: z.string().trim().min(1).max(4000),
    index: z.string().trim().min(1).max(200).default('logs-*'),
    serviceField: z.string().trim().min(1).max(100).default('service.name'),
  }),
  z.object({
    tool: z.literal('betterstack'),
    apiToken: z.string().trim().min(1).max(4000),
    sourceName: z.string().trim().max(200).optional(),
  }),
]);
export type AutoSetupInput = z.input<typeof autoSetupSchema>;

export interface AutoSetupResult {
  tool: ToolView;
  done: string[];
  todo: string[];
}

export const vercelDrainSchema = z.object({
  accessToken: z.string().trim().min(1).max(4000),
  teamId: z.string().trim().max(100).optional(),
});
export const herokuDrainSchema = z.object({
  /** A Heroku API key; omit after "Sign in with Heroku". */
  apiKey: z.string().trim().max(4000).optional(),
  apps: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});
export const renderStreamSchema = z.object({ apiKey: z.string().trim().min(1).max(4000) });
export type VercelDrainInput = z.input<typeof vercelDrainSchema>;
export type HerokuDrainInput = z.input<typeof herokuDrainSchema>;
export type RenderStreamInput = z.input<typeof renderStreamSchema>;

export interface DrainSetupResult {
  done: string[];
  todo: string[];
  failed: string[];
}

export const herokuAppsSchema = z.object({ apiKey: z.string().trim().max(4000).optional() });
export interface HerokuApps {
  apps: string[];
}

export interface OAuthStart {
  url: string;
}

export const oauthCallbackSchema = z.object({
  state: z.string().min(10).max(2000),
  code: z.string().max(2000).optional(),
  installationId: z.string().max(200).optional(),
  configurationId: z.string().max(200).optional(),
  teamId: z.string().max(200).optional(),
});
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

export interface OAuthCallbackResult {
  provider: 'sentry' | 'vercel' | 'heroku' | 'github';
  done: string[];
  todo: string[];
  /** Heroku: choose which apps get a drain next. */
  herokuApps?: string[];
  /** GitHub: pick repositories for this workspace after the App install callback. */
  githubInstallationId?: number;
}

export const githubSetupCallbackSchema = z.object({
  installationId: z.coerce.number().int().positive(),
  state: z.string().min(10).max(2000),
});
export type GitHubSetupCallbackInput = z.input<typeof githubSetupCallbackSchema>;

export interface AwsSetupStart {
  command: string;
  templateUrl: string;
  expiresAt: string;
}

/** What the connected GitHub App installations can do, refreshed from GitHub. */
export interface GitHubOverview {
  configured: boolean;
  installations: {
    integrationId: string;
    installationId: number;
    account: string;
    status: 'connected' | 'error' | 'pending' | 'disconnected';
    lastError: string | null;
    repositorySelection: 'all' | 'selected' | null;
    repositories: string[];
    permissions: Record<string, string>;
    /** Where the account owner adds repositories to the installation. */
    manageUrl: string;
  }[];
  /** Permissions each automation needs that the App does not have. */
  missing: { setupPullRequest: string[]; deployWorkflow: string[] };
  /** Where the App owner changes the App's permissions. */
  appPermissionsUrl: string | null;
  /** Repositories set on Services that no installation can read. */
  unreachableServiceRepos: string[];
}

// ----- Deploys -----
export const deploymentListQuerySchema = z.object({
  /** Telemetry service name, as the deploy marker reported it. */
  service: z.string().trim().min(1).max(100).optional(),
  environment: z.string().trim().min(1).max(40).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type DeploymentListQuery = z.input<typeof deploymentListQuerySchema>;

/** One deploy marker received by a deploy webhook, newest first. */
export interface Deployment {
  id: string;
  serviceId: string | null;
  serviceName: string;
  environment: string;
  commitSha: string;
  version: string | null;
  deployedAt: string;
  /** Name of the deploy webhook that sent it, or null if that webhook was deleted. */
  integrationName: string | null;
}

/** One deploy, its neighbours for the same service and environment, and what opened after it. */
export interface DeploymentDetail extends Deployment {
  previous: Deployment | null;
  next: Deployment | null;
  /** Incidents of this service and environment first seen after this deploy, before the next. */
  incidents: Pick<Incident, 'id' | 'title' | 'severity' | 'status' | 'firstSeenAt'>[];
  repositoryFullName: string | null;
}

// ----- Business impact -----
export const serviceValueSchema = z.object({
  /** Business value of one successful request; null clears it. */
  valuePerRequest: z.number().positive().max(1_000_000).nullable(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD or INR')
    .default('USD'),
});
export type ServiceValueInput = z.input<typeof serviceValueSchema>;

export const businessImpactQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});
export type BusinessImpactQuery = z.input<typeof businessImpactQuerySchema>;

export interface ServiceImpact {
  serviceId: string;
  serviceName: string;
  environment: string;
  valuePerRequest: number | null;
  currency: string | null;
  /** Distinct failed traces: error spans plus incident error events, each trace counted once. */
  failedRequests: number;
  errorSpanTraces: number;
  incidentErrorEvents: number;
  incidents: number;
  /** failedRequests × valuePerRequest, or null when no value is set. */
  impact: number | null;
}

export interface BusinessImpact {
  from: string;
  to: string;
  days: number;
  services: ServiceImpact[];
}

// ----- Usage and limits (FR-16) -----
export const workspaceLimitsSchema = z.object({
  monthlyAiBudgetUsd: z.number().min(0).max(1_000_000).nullable(),
  maxConcurrentInvestigations: z.number().int().min(1).max(100).nullable(),
});
export type WorkspaceLimits = z.infer<typeof workspaceLimitsSchema>;

export interface UsageMonth {
  /** UTC month, `YYYY-MM`. */
  month: string;
  investigations: number;
  inputTokens: number;
  outputTokens: number;
  aiCostUsd: number;
  sandboxMinutes: number;
}

export interface UsageSummary {
  /** Last 6 UTC months, newest first. Months with no usage are included as zeros. */
  months: UsageMonth[];
  limits: WorkspaceLimits;
  runningInvestigations: number;
  /** Why a new investigation would be blocked right now, or null. */
  blockedReason: string | null;
}
