import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { incidents } from './incidents';
import { id, timestamps } from './helpers';

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
