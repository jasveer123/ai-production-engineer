import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { incidents } from './incidents';
import { deployments } from './ingestion';
import { investigations } from './investigation';
import { id, timestamps } from './helpers';

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

  kind: text('kind').notNull(),

  attempt: integer('attempt').notNull().default(0),
  sandboxImage: text('sandbox_image').notNull(),

  status: text('status').notNull(),
  exitCode: integer('exit_code'),
  durationMs: integer('duration_ms'),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  resultReference: text('result_reference'),
  ...timestamps(),
});

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

    status: text('status').notNull(),

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

  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  actorId: uuid('actor_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').notNull(),
  policyVersion: text('policy_version').notNull(),
  artifactHash: text('artifact_hash'),

  actorRole: text('actor_role'),
  ...timestamps(),
});

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

    status: text('status').notNull().default('observing'),
    outcome: text('outcome'),
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
  errors: number;
  durationMs: number;
  errorsPerHour: number;
}

export interface VerificationObserved {
  errors: number;
  durationMs: number;

  requests: number | null;
  operation: string | null;

  expectedErrors: number;
}
