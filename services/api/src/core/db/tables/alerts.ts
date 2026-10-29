import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { integrations } from './integrations-and-services';
import { incidents } from './incidents';
import { severityEnum } from './enums';
import { id, timestamps } from './helpers';
import { workspaceRef } from './identity-and-tenancy';

export const alertStatusEnum = pgEnum('alert_status', ['firing', 'resolved']);

export const alertRoutes = pgTable(
  'alert_routes',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),

    sourceIds: uuid('source_ids').array().notNull().default([]),
    conditions: jsonb('conditions').$type<AlertCondition[]>().notNull().default([]),
    groupBy: text('group_by').array().notNull().default([]),
    createIncident: boolean('create_incident').notNull().default(true),

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
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'not_contains' | 'regex' | 'exists' | 'not_exists';
  value?: string;
}
