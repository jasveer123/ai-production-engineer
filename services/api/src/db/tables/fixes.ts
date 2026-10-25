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
