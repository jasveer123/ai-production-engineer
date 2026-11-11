import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { severityEnum } from './enums';
import { id, timestamps } from './helpers';
import { users, workspaceRef } from './identity-and-tenancy';
import { incidents } from './incidents';

export interface StoredTarget {
  kind: 'schedule' | 'user' | 'everyone';
  scheduleId?: string;
  userId?: string;
}

export interface StoredStep {
  waitMinutes: number;
  targets: StoredTarget[];
}

export const escalationPolicies = pgTable(
  'escalation_policies',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    minSeverity: severityEnum('min_severity').notNull().default('high'),
    enabled: boolean('enabled').notNull().default(true),
    steps: jsonb('steps').$type<StoredStep[]>().notNull().default([]),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('escalation_policies_workspace_idx').on(t.workspaceId)],
);

export const escalationRuns = pgTable(
  'escalation_runs',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => escalationPolicies.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull().default(0),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    state: text('state').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('escalation_runs_incident_policy_key').on(t.incidentId, t.policyId),
    index('escalation_runs_due_idx').on(t.state, t.nextRunAt),
  ],
);

export const escalationNotifications = pgTable(
  'escalation_notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    runId: uuid('run_id')
      .notNull()
      .references(() => escalationRuns.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    status: text('status').notNull(),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('escalation_notifications_run_idx').on(t.runId)],
);
