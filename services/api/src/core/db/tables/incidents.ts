import { sql } from 'drizzle-orm';
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
import { integrations, services } from './integrations-and-services';
import { incidentStatusEnum, severityEnum } from './enums';
import { id, timestamps } from './helpers';

export const incidents = pgTable(
  'incidents',
  {
    id: id(),
    workspaceId: workspaceRef(),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),

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
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolutionOrigin: text('resolution_origin').$type<'manual' | 'automatic'>(),
    resolutionReason: text('resolution_reason'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    monitorId: uuid('monitor_id').references(() => integrations.id, { onDelete: 'set null' }),
    // null means never edited by hand, so the monitor/source metadata is inherited
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    postMortem: text('post_mortem'),
    postMortemUpdatedAt: timestamp('post_mortem_updated_at', { withTimezone: true }),
    postMortemUpdatedBy: uuid('post_mortem_updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps(),
  },
  (t) => [
    index('incidents_workspace_started_idx').on(t.workspaceId, t.firstSeenAt),
    index('incidents_monitor_idx').on(t.monitorId),
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
    kind: text('kind').notNull().default('error'),
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

    uniqueIndex('incident_events_trace_key')
      .on(t.incidentId, t.traceId)
      .where(sql`${t.traceId} is not null and ${t.kind} = 'error'`),
    index('incident_events_incident_idx').on(t.incidentId),
    index('incident_events_incident_time_idx').on(t.incidentId, t.occurredAt),
  ],
);
