import { sql } from 'drizzle-orm';
import {
  bigserial,
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

// ---------- Investigation ----------

export const investigations = pgTable('investigations', {
  id: id(),
  workspaceId: workspaceRef(),
  incidentId: uuid('incident_id')
    .notNull()
    .references(() => incidents.id, { onDelete: 'cascade' }),
  workflowId: text('workflow_id').notNull(),
  status: text('status').notNull(),
  promptVersion: text('prompt_version'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps(),
});

export const evidenceItems = pgTable('evidence_items', {
  id: id(),
  workspaceId: workspaceRef(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  sourceReference: text('source_reference').notNull(),
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
  confidenceRationale: text('confidence_rationale'),
  supportingEvidenceIds: uuid('supporting_evidence_ids').array().notNull().default([]),
  contradictingEvidenceIds: uuid('contradicting_evidence_ids').array().notNull().default([]),
  missingInformation: jsonb('missing_information').$type<string[]>().notNull().default([]),
  ...timestamps(),
});

// ---------- Fixes ----------

export const fixProposals = pgTable('fix_proposals', {
  id: id(),
  workspaceId: workspaceRef(),
  investigationId: uuid('investigation_id')
    .notNull()
    .references(() => investigations.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  baseCommitSha: text('base_commit_sha').notNull(),
  patchReference: text('patch_reference'),
  patchHash: text('patch_hash'),
  status: text('status').notNull(),
  ...timestamps(),
});

export const validationRuns = pgTable('validation_runs', {
  id: id(),
  workspaceId: workspaceRef(),
  fixProposalId: uuid('fix_proposal_id')
    .notNull()
    .references(() => fixProposals.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // baseline | regression | full_suite | static
  sandboxImage: text('sandbox_image').notNull(),
  status: text('status').notNull(), // passed | failed | skipped | error
  exitCode: integer('exit_code'),
  resultReference: text('result_reference'),
  ...timestamps(),
});

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: id(),
    workspaceId: workspaceRef(),
    fixProposalId: uuid('fix_proposal_id')
      .notNull()
      .references(() => fixProposals.id, { onDelete: 'cascade' }),
    branchName: text('branch_name').notNull(),
    providerPrId: text('provider_pr_id'),
    url: text('url'),
    status: text('status').notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex('pull_requests_branch_key').on(t.workspaceId, t.branchName)],
);

export const approvals = pgTable('approvals', {
  id: id(),
  workspaceId: workspaceRef(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').notNull(), // approved | rejected
  policyVersion: text('policy_version').notNull(),
  artifactHash: text('artifact_hash'),
  ...timestamps(),
});

export const verificationRuns = pgTable('verification_runs', {
  id: id(),
  workspaceId: workspaceRef(),
  incidentId: uuid('incident_id')
    .notNull()
    .references(() => incidents.id, { onDelete: 'cascade' }),
  deployCommitSha: text('deploy_commit_sha').notNull(),
  outcome: text('outcome'), // recovered | not_recovered | inconclusive
  baseline: jsonb('baseline'),
  observed: jsonb('observed'),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
  windowEndedAt: timestamp('window_ended_at', { withTimezone: true }),
  ...timestamps(),
});

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

export type Role = (typeof roleEnum.enumValues)[number];
export type Severity = (typeof severityEnum.enumValues)[number];
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];

export interface SeverityRule {
  environment?: string;
  serviceName?: string;
  errorType?: string;
  severity: Severity;
}

export interface WorkspaceSettings {
  severityRules?: SeverityRule[];
}
