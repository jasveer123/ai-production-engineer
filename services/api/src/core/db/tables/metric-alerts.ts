import {
  boolean,
  doublePrecision,
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
import { integrations } from './integrations-and-services';

export const metricAlertRules = pgTable(
  'metric_alert_rules',
  {
    id: id(),
    workspaceId: workspaceRef(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    query: jsonb('query').$type<Record<string, unknown>>().notNull(),
    condition: jsonb('condition').$type<Record<string, unknown>>().notNull(),
    windowMinutes: integer('window_minutes').notNull().default(5),
    everySeconds: integer('every_seconds').notNull().default(60),
    perSeries: boolean('per_series').notNull().default(false),
    confirmationSeconds: integer('confirmation_seconds').notNull().default(0),
    recoverySeconds: integer('recovery_seconds').notNull().default(0),
    missingData: text('missing_data').notNull().default('keep'),
    severity: severityEnum('severity').notNull().default('high'),
    escalationPolicyId: uuid('escalation_policy_id'),
    paused: boolean('paused').notNull().default(false),
    nextEvalAt: timestamp('next_eval_at', { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('metric_alert_rules_workspace_idx').on(t.workspaceId),
    index('metric_alert_rules_due_idx').on(t.paused, t.nextEvalAt),
  ],
);

export const metricAlertStates = pgTable(
  'metric_alert_states',
  {
    id: id(),
    workspaceId: workspaceRef(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => metricAlertRules.id, { onDelete: 'cascade' }),
    seriesKey: text('series_key').notNull(),
    state: text('state').notNull().default('ok'),
    since: timestamp('since', { withTimezone: true }).notNull().defaultNow(),
    pendingSince: timestamp('pending_since', { withTimezone: true }),
    lastValue: doublePrecision('last_value'),
    lastObservation: text('last_observation'),
    lastEvaluatedAt: timestamp('last_evaluated_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('metric_alert_states_rule_series_key').on(t.ruleId, t.seriesKey),
    index('metric_alert_states_workspace_idx').on(t.workspaceId),
  ],
);
