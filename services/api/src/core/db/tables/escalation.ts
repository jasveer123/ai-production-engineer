import { sql } from 'drizzle-orm';
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
  kind: 'schedule' | 'user' | 'everyone' | 'channel';
  scheduleId?: string;
  userId?: string;
  channelId?: string;
}

export interface StoredStep {
  waitMinutes: number;
  targets: StoredTarget[];
  channels?: ('email' | 'sms' | 'call' | 'push')[];
}

export interface StoredCondition {
  minSeverity?: 'critical' | 'high' | 'medium' | 'low';
  metadata?: { key: 'service' | 'environment' | 'source'; value: string }[];
  timeWindow?: { days: number[]; from: string; to: string; timezone: string };
}

export interface StoredBranch {
  name: string;
  when: StoredCondition;
  steps: StoredStep[];
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
    branches: jsonb('branches').$type<StoredBranch[]>().notNull().default([]),
    isDefault: boolean('is_default').notNull().default(false),
    repeatCount: integer('repeat_count').notNull().default(0),
    generated: boolean('generated').notNull().default(false),
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
    policyId: uuid('policy_id').references(() => escalationPolicies.id, { onDelete: 'set null' }),
    policyName: text('policy_name'),
    policySource: text('policy_source'),
    branchName: text('branch_name'),
    stepsSnapshot: jsonb('steps_snapshot').$type<StoredStep[]>(),
    repeatCount: integer('repeat_count').notNull().default(0),
    repeatsDone: integer('repeats_done').notNull().default(0),
    stepIndex: integer('step_index').notNull().default(0),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    state: text('state').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('escalation_runs_incident_policy_key').on(t.incidentId, t.policyId),
    uniqueIndex('escalation_runs_incident_key')
      .on(t.incidentId)
      .where(sql`${t.policySource} is not null`),
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
