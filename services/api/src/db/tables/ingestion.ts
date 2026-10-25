import { sql } from 'drizzle-orm';
import {
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
import { integrations, services } from './integrations-and-services';
import { id, timestamps } from './helpers';
import { workspaceRef } from './identity-and-tenancy';

/** Encrypted secrets for local development. `integrations.secret_reference` points here. */
export const secrets = pgTable('secrets', {
  id: id(),
  workspaceId: workspaceRef(),
  ciphertext: text('ciphertext').notNull(),
  ...timestamps(),
});

export const inboundEventStatusEnum = pgEnum('inbound_event_status', [
  'pending',
  'processed',
  'dead',
]);

/**
 * Durable buffer between receivers and the processor. Rows are written before any processing,
 * so an acknowledged event is never lost. `dead` rows are the dead-letter queue.
 */
export const inboundEvents = pgTable(
  'inbound_events',
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    externalEventId: text('external_event_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: inboundEventStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    deadReason: text('dead_reason'),
    lastError: text('last_error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('inbound_events_external_key').on(t.integrationId, t.externalEventId),
    index('inbound_events_pending_idx')
      .on(t.nextAttemptAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const deployments = pgTable(
  'deployments',
  {
    id: id(),
    workspaceId: workspaceRef(),
    integrationId: uuid('integration_id').references(() => integrations.id, {
      onDelete: 'set null',
    }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
    serviceName: text('service_name').notNull(),
    environment: text('environment').notNull(),
    commitSha: text('commit_sha').notNull(),
    version: text('version'),
    externalEventId: text('external_event_id').notNull(),
    deployedAt: timestamp('deployed_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('deployments_external_key').on(t.integrationId, t.externalEventId),
    index('deployments_service_time_idx').on(
      t.workspaceId,
      t.serviceName,
      t.environment,
      t.deployedAt,
    ),
  ],
);
