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

    attempt: integer('attempt').notNull().default(1),

    status: text('status').notNull(),
    statusReason: text('status_reason'),
    promptVersion: text('prompt_version'),
    model: text('model'),
    evidenceBundleRef: text('evidence_bundle_ref'),
    reportRef: text('report_ref'),

    coverage: jsonb('coverage').$type<Record<string, unknown>>().notNull().default({}),
    observations: jsonb('observations').$type<unknown[]>().notNull().default([]),
    dataGaps: jsonb('data_gaps').$type<string[]>().notNull().default([]),

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

  ref: text('ref').notNull(),
  kind: text('kind').notNull(),
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

  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  confidenceLabel: text('confidence_label'),
  suspectedLocation: jsonb('suspected_location').$type<Record<string, unknown> | null>(),
  confidenceRationale: text('confidence_rationale'),
  supportingEvidenceIds: uuid('supporting_evidence_ids').array().notNull().default([]),
  contradictingEvidenceIds: uuid('contradicting_evidence_ids').array().notNull().default([]),
  missingInformation: jsonb('missing_information').$type<string[]>().notNull().default([]),
  ...timestamps(),
});

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
    verdict: text('verdict').notNull(),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('hypothesis_feedback_user_key').on(t.hypothesisId, t.userId),
    index('hypothesis_feedback_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
);
