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
    // One trace counts once per incident, even when two integrations deliver it.
    uniqueIndex('incident_events_trace_key')
      .on(t.incidentId, t.traceId)
      .where(sql`${t.traceId} is not null and ${t.kind} = 'error'`),
    index('incident_events_incident_idx').on(t.incidentId),
  ],
);
