import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Every table gets a UUID id and created_at/updated_at. Tenant-owned tables carry workspace_id.
const id = () => uuid('id').primaryKey().defaultRandom();
const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
const workspaceRef = () =>
  uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' });

export const roleEnum = pgEnum('workspace_role', ['owner', 'admin', 'engineer', 'viewer']);
export const workspaceStatusEnum = pgEnum('workspace_status', ['active', 'suspended']);
export const integrationStatusEnum = pgEnum('integration_status', [
  'pending',
  'connected',
  'error',
  'disconnected',
]);
export const incidentStatusEnum = pgEnum('incident_status', [
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
]);
export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low']);
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'denied', 'failure']);

// ---------- Identity & tenancy ----------

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    identityProvider: text('identity_provider').notNull(),
    identityProviderId: text('identity_provider_id').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    uniqueIndex('users_identity_key').on(t.identityProvider, t.identityProviderId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  status: workspaceStatusEnum('status').notNull().default('active'),
  settings: jsonb('settings').$type<WorkspaceSettings>().notNull().default({}),
  ...timestamps(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('workspace_members_key').on(t.workspaceId, t.userId),
    index('workspace_members_user_idx').on(t.userId),
  ],
);

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    email: text('email').notNull(),
    role: roleEnum('role').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('workspace_invitations_email_idx').on(sql`lower(${t.email})`)],
);

// ---------- Integrations & services ----------

export const integrations = pgTable(
  'integrations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    provider: text('provider').notNull(), // deploy_webhook | otel_jaeger | github | sentry
    name: text('name').notNull().default(''),
    externalAccountId: text('external_account_id'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    status: integrationStatusEnum('status').notNull().default('pending'),
    // Reference into a secret manager. Never the secret itself.
    secretReference: text('secret_reference'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps(),
  },
  (t) => [index('integrations_workspace_idx').on(t.workspaceId)],
);

export const services = pgTable(
  'services',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    environment: text('environment').notNull(),
    repositoryFullName: text('repository_full_name'), // e.g. "owner/demo-shop"
    defaultBranch: text('default_branch').notNull().default('main'),
    /** How to run this service's tests in the sandbox (see SandboxProfile). */
    sandbox: jsonb('sandbox').$type<SandboxProfile | null>(),
    integrationId: uuid('integration_id').references(() => integrations.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('services_name_env_key').on(t.workspaceId, t.name, t.environment)],
);

// ---------- Incidents ----------

export const incidents = pgTable(
  'incidents',
  {
    id: id(),
    workspaceId: workspaceRef(),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    // Telemetry service name as reported by the source, kept even when unmapped.
    serviceName: text('service_name'),
    environment: text('environment'),
    source: text('source').notNull().default('manual'),
    fingerprint: text('fingerprint').notNull(),
    eventCount: integer('event_count').notNull().default(0),
    status: incidentStatusEnum('status').notNull().default('detected'),
    severity: severityEnum('severity').notNull().default('medium'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
    ...timestamps(),
  },
  (t) => [
    // Dedup applies to open incidents only; a recurrence after resolution opens a new one.
    uniqueIndex('incidents_open_fingerprint_key')
      .on(t.workspaceId, t.fingerprint)
      .where(sql`${t.status} not in ('resolved', 'closed_without_fix')`),
    index('incidents_workspace_status_idx').on(t.workspaceId, t.status),
  ],
);

export const incidentEvents = pgTable(
  'incident_events',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id').references(() => integrations.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull().default('error'), // error | status_change | created
    source: text('source').notNull(),
    externalEventId: text('external_event_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    summary: text('summary'),
    traceId: text('trace_id'),
    sourceUrl: text('source_url'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    artifactReference: text('artifact_reference'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('incident_events_external_key').on(t.integrationId, t.externalEventId),
    // One trace counts once per incident, even when two integrations deliver it.
    uniqueIndex('incident_events_trace_key')
      .on(t.incidentId, t.traceId)
      .where(sql`${t.traceId} is not null and ${t.kind} = 'error'`),
    index('incident_events_incident_idx').on(t.incidentId),
  ],
);

// ---------- Ingestion ----------

/** Encrypted secrets for local development. `integrations.secret_reference` points here. */
export const secrets = pgTable('secrets', {
  id: id(),
  workspaceId: workspaceRef(),
  ciphertext: text('ciphertext').notNull(),
  ...timestamps(),
});

export const inboundEventStatusEnum = pgEnum('inbound_event_status', [
  'pending',
  'processed',
  'dead',
]);

/**
 * Durable buffer between receivers and the processor. Rows are written before any processing,
 * so an acknowledged event is never lost. `dead` rows are the dead-letter queue.
 */
export const inboundEvents = pgTable(
  'inbound_events',
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    externalEventId: text('external_event_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: inboundEventStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    deadReason: text('dead_reason'),
    lastError: text('last_error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('inbound_events_external_key').on(t.integrationId, t.externalEventId),
    index('inbound_events_pending_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const deployments = pgTable(
  'deployments',
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid('integration_id').references(() => integrations.id, {
      onDelete: 'set null',
    }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    serviceName: text('service_name').notNull(),
    environment: text('environment').notNull(),
    commitSha: text('commit_sha').notNull(),
    version: text('version'),
    externalEventId: text('external_event_id').notNull(),
    deployedAt: timestamp('deployed_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('deployments_external_key').on(t.integrationId, t.externalEventId),
    index('deployments_service_time_idx').on(
      t.workspaceId,
      t.serviceName,
      t.environment,
      t.deployedAt,
    ),
  ],
);

// ---------- Alerts (Phase 10) ----------

export const alertStatusEnum = pgEnum('alert_status', ['firing', 'resolved']);

/**
 * Ordered rules that decide what an incoming alert does. The first enabled route whose sources
 * and conditions match wins. Alerts that share the route's `groupBy` label values join the same
 * open incident instead of opening a new one.
 */
export const alertRoutes = pgTable(
  'alert_routes',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    /** Alert source integration ids; empty means every source. */
    sourceIds: uuid('source_ids').array().notNull().default([]),
    conditions: jsonb('conditions').$type<AlertCondition[]>().notNull().default([]),
    groupBy: text('group_by').array().notNull().default([]),
    createIncident: boolean('create_incident').notNull().default(true),
    /** Fixed severity for incidents from this route; null maps the alert's own severity. */
    incidentSeverity: severityEnum('incident_severity'),
    ...timestamps(),
  },
  (t) => [index('alert_routes_workspace_idx').on(t.workspaceId, t.position)],
);

export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    workspaceId: workspaceRef(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    routeId: uuid('route_id').references(() => alertRoutes.id, { onDelete: 'set null' }),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
    /** The source's own identity for the alert (fingerprint, issue id, aggregate key). */
    dedupKey: text('dedup_key').notNull(),
    status: alertStatusEnum('status').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: severityEnum('severity').notNull().default('medium'),
    labels: jsonb('labels').$type<Record<string, string>>().notNull().default({}),
    sourceUrl: text('source_url'),
    groupKey: text('group_key'),
    occurrences: integer('occurrences').notNull().default(1),
    firstFiredAt: timestamp('first_fired_at', { withTimezone: true }).notNull(),
    lastFiredAt: timestamp('last_fired_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('alerts_source_dedup_key').on(t.sourceId, t.dedupKey),
    index('alerts_workspace_status_idx').on(t.workspaceId, t.status, t.lastFiredAt),
    index('alerts_incident_idx').on(t.incidentId),
  ],
);

export interface AlertCondition {
  /** `title`, `description`, `severity`, `status` or `label.<name>`. */
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'not_contains' | 'regex' | 'exists' | 'not_exists';
  value?: string;
}

// ---------- Investigation ----------

export const investigations = pgTable(
  'investigations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id').notNull(),
    /** 1 for the first run; "Investigate further" starts attempt 2, 3, ... */
    attempt: integer('attempt').notNull().default(1),
    // collecting_evidence | analyzing | completed | needs_review | failed | cancelled
    status: text('status').notNull(),
    statusReason: text('status_reason'),
    promptVersion: text('prompt_version'),
    model: text('model'),
    evidenceBundleRef: text('evidence_bundle_ref'),
    reportRef: text('report_ref'),
    /** Which evidence sources were available, empty or missing (FR-04: never fabricate). */
    coverage: jsonb('coverage').$type<Record<string, unknown>>().notNull().default({}),
    observations: jsonb('observations').$type<unknown[]>().notNull().default([]),
    dataGaps: jsonb('data_gaps').$type<string[]>().notNull().default([]),
    /** Items the evidence guard removed (cited unknown or no evidence). */
    rejected: jsonb('rejected').$type<unknown[]>().notNull().default([]),
    usage: jsonb('usage').$type<Record<string, unknown>>().notNull().default({}),
    requestNote: text('request_note'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('investigations_workflow_attempt_key').on(t.workflowId, t.attempt),
    index('investigations_incident_idx').on(t.incidentId),
  ],
);

export const evidenceItems = pgTable('evidence_items', {
  id: id(),
  workspaceId: workspaceRef(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id, { onDelete: 'cascade' }),
  /** Short id the model cites, e.g. "E3". Unique within an investigation. */
  ref: text('ref').notNull(),
  kind: text('kind').notNull(), // error_event | trace | deploy | code | commit
  title: text('title').notNull(),
  sourceReference: text('source_reference').notNull(),
  sourceUrl: text('source_url'),
  artifactReference: text('artifact_reference'),
  contentHash: text('content_hash').notNull(),
  ...timestamps(),
});

export const hypotheses = pgTable('hypotheses', {
  id: id(),
  workspaceId: workspaceRef(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  summary: text('summary').notNull(),
  // A model-generated estimate, not a calibrated probability.
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  confidenceLabel: text('confidence_label'), // high | medium | low
  suspectedLocation: jsonb('suspected_location').$type<Record<string, unknown> | null>(),
  confidenceRationale: text('confidence_rationale'),
  supportingEvidenceIds: uuid('supporting_evidence_ids').array().notNull().default([]),
  contradictingEvidenceIds: uuid('contradicting_evidence_ids').array().notNull().default([]),
  missingInformation: jsonb('missing_information').$type<string[]>().notNull().default([]),
  ...timestamps(),
});

/**
 * An engineer's verdict on a hypothesis (Phase 9): the online counterpart of the offline
 * evaluation. One row per person per hypothesis; changing your mind updates it.
 */
export const hypothesisFeedback = pgTable(
  'hypothesis_feedback',
  {
    id: id(),
    workspaceId: workspaceRef(),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    hypothesisId: uuid('hypothesis_id')
      .notNull()
      .references(() => hypotheses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    verdict: text('verdict').notNull(), // correct | partly | wrong
    note: text('note'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('hypothesis_feedback_user_key').on(t.hypothesisId, t.userId),
    index('hypothesis_feedback_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
);

// ---------- Fixes ----------

/**
 * One reproduce-and-fix attempt for an incident (Workflow B). `version` increases on
 * "Regenerate". Status: preparing | baseline_failed | reproducing | not_reproduced | patching |
 * validating | validated | validation_failed | rejected | error.
 */
export const fixProposals = pgTable(
  'fix_proposals',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }),
    investigationId: uuid('investigation_id')
      .notNull()
      .references(() => investigations.id, { onDelete: 'cascade' }),
    workflowRunKey: text('workflow_run_key'),
    version: integer('version').notNull().default(1),
    repositoryFullName: text('repository_full_name'),
    baseCommitSha: text('base_commit_sha').notNull(),
    sourceReference: text('source_reference'),
    status: text('status').notNull(),
    statusReason: text('status_reason'),
    testPath: text('test_path'),
    testReference: text('test_reference'),
    testRationale: text('test_rationale'),
    patchReference: text('patch_reference'),
    patchHash: text('patch_hash'),
    explanation: text('explanation'),
    diffStat: jsonb('diff_stat').$type<{ files: number; additions: number; deletions: number }>(),
    patchAttempts: integer('patch_attempts').notNull().default(0),
    policyViolations: jsonb('policy_violations').$type<string[]>().notNull().default([]),
    usage: jsonb('usage').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('fix_proposals_run_version_key').on(t.workflowRunKey, t.version),
    index('fix_proposals_incident_idx').on(t.incidentId),
  ],
);

export const validationRuns = pgTable('validation_runs', {
  id: id(),
  workspaceId: workspaceRef(),
  fixProposalId: uuid('fix_proposal_id')
    .notNull()
    .references(() => fixProposals.id, { onDelete: 'cascade' }),
  // baseline | reproduction | regression | full_suite | policy
  kind: text('kind').notNull(),
  /** Patch attempt this run belongs to (0 = before any patch). */
  attempt: integer('attempt').notNull().default(0),
  sandboxImage: text('sandbox_image').notNull(),
  // passed | failed | skipped | error (error = the sandbox itself failed, not the code)
  status: text('status').notNull(),
  exitCode: integer('exit_code'),
  durationMs: integer('duration_ms'),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  resultReference: text('result_reference'),
  ...timestamps(),
});

/** A pull request opened for an approved fix. One per fix proposal (deterministic branch). */
export const pullRequests = pgTable(
  'pull_requests',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'cascade' }),
    fixProposalId: uuid('fix_proposal_id')
      .notNull()
      .references(() => fixProposals.id, { onDelete: 'cascade' }),
    approvalId: uuid('approval_id'),
    repositoryFullName: text('repository_full_name'),
    branchName: text('branch_name').notNull(),
    baseBranch: text('base_branch'),
    headSha: text('head_sha'),
    providerPrId: text('provider_pr_id'),
    number: integer('number'),
    url: text('url'),
    title: text('title'),
    // open | merged | closed
    status: text('status').notNull(),
    // pending | passing | failing | none
    checksStatus: text('checks_status').notNull().default('pending'),
    checks: jsonb('checks')
      .$type<{ name: string; status: string; conclusion: string | null }[]>()
      .notNull()
      .default([]),
    mergeCommitSha: text('merge_commit_sha'),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('pull_requests_branch_key').on(t.workspaceId, t.branchName),
    uniqueIndex('pull_requests_fix_key').on(t.fixProposalId),
  ],
);

export const approvals = pgTable('approvals', {
  id: id(),
  workspaceId: workspaceRef(),
  // reproduction | pull_request
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').notNull(), // approved | rejected
  policyVersion: text('policy_version').notNull(),
  artifactHash: text('artifact_hash'),
  /** The role the approver held when approving (re-checked again at execution time). */
  actorRole: text('actor_role'),
  ...timestamps(),
});

/**
 * One observation window after the fix was deployed (Phase 7). Window n observes
 * [deploy + grace, deploy + grace + n * window], so an extension adds data instead of resetting.
 */
export const verificationRuns = pgTable(
  'verification_runs',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    deploymentId: uuid('deployment_id').references(() => deployments.id, {
      onDelete: 'set null',
    }),
    window: integer('window').notNull().default(1),
    deployCommitSha: text('deploy_commit_sha').notNull(),
    // observing | completed
    status: text('status').notNull().default('observing'),
    outcome: text('outcome'), // recovered | not_recovered | inconclusive
    reason: text('reason'),
    baseline: jsonb('baseline').$type<VerificationBaseline>(),
    observed: jsonb('observed').$type<VerificationObserved>(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
    windowEndedAt: timestamp('window_ended_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('verification_runs_window_key').on(t.incidentId, t.deploymentId, t.window)],
);

export interface VerificationBaseline {
  /** Errors with the incident's fingerprint before the fix deploy. */
  errors: number;
  durationMs: number;
  errorsPerHour: number;
}

export interface VerificationObserved {
  errors: number;
  durationMs: number;
  /** Requests to the failing operation in the window (Jaeger), or null when unknown. */
  requests: number | null;
  operation: string | null;
  /** Errors the pre-fix rate predicts for this window if nothing had changed. */
  expectedErrors: number;
}

// ---------- Audit, usage, outbox ----------

// Append-only: a trigger in the migration rejects UPDATE and DELETE.
export const auditEvents = pgTable(
  'audit_events',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull().default('user'), // user | agent | system
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    outcome: auditOutcomeEnum('outcome').notNull(),
    correlationId: text('correlation_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_events_workspace_time_idx').on(t.workspaceId, t.occurredAt)],
);

export const usageRecords = pgTable(
  'usage_records',
  {
    id: id(),
    workspaceId: workspaceRef(),
    metric: text('metric').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('usage_records_workspace_metric_idx').on(t.workspaceId, t.metric, t.recordedAt)],
);

export const outbox = pgTable(
  'outbox',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** Failed rows back off instead of being retried in a tight loop. */
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('outbox_unpublished_idx')
      .on(t.createdAt)
      .where(sql`${t.publishedAt} is null`),
  ],
);

// ---------- Notifications (Phase 8) ----------

/**
 * Where incident notifications go. A Slack webhook URL is itself a credential, so it lives in the
 * secret store; a generic webhook keeps its URL here and its HMAC signing secret in the store.
 */
export const notificationChannels = pgTable(
  'notification_channels',
  {
    id: id(),
    workspaceId: workspaceRef(),
    kind: text('kind').notNull(), // slack | webhook
    name: text('name').notNull(),
    url: text('url'),
    secretReference: text('secret_reference'),
    events: text('events').array().notNull().default([]),
    minSeverity: severityEnum('min_severity').notNull().default('low'),
    enabled: boolean('enabled').notNull().default(true),
    lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('notification_channels_workspace_idx').on(t.workspaceId)],
);

/** One row per (channel, event): a retried outbox row never notifies a channel twice. */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: id(),
    workspaceId: workspaceRef(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => notificationChannels.id, { onDelete: 'cascade' }),
    eventKey: text('event_key').notNull(),
    eventType: text('event_type').notNull(),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
    status: text('status').notNull(), // sent | failed
    attempts: integer('attempts').notNull().default(1),
    responseStatus: integer('response_status'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('notification_deliveries_key').on(t.channelId, t.eventKey),
    index('notification_deliveries_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type Severity = (typeof severityEnum.enumValues)[number];
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];

export interface SeverityRule {
  environment?: string;
  serviceName?: string;
  errorType?: string;
  severity: Severity;
}

export interface SandboxProfile {
  runtime: 'node22-pnpm';
  /** Package directory inside the repo, e.g. "api". */
  packageDir: string;
  /** Run inside packageDir; must accept extra test file paths as arguments. */
  testCommand: string;
  /** Where generated regression tests go, relative to packageDir. */
  testDir: string;
}

export interface ApprovalPolicy {
  /** Lowest role allowed to approve a pull request. */
  prMinRole: Role;
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = { prMinRole: 'engineer' };
export const APPROVAL_POLICY_VERSION = 'pr-approval-v1';

export interface WorkspaceSettings {
  severityRules?: SeverityRule[];
  approvalPolicy?: ApprovalPolicy;
}
