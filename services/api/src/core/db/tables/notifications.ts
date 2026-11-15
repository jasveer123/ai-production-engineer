import {
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
import { users, workspaceRef } from './identity-and-tenancy';
import { incidents } from './incidents';
import { severityEnum } from './enums';
import { id, timestamps } from './helpers';
import { escalationRuns } from './escalation';

export const notificationChannels = pgTable(
  'notification_channels',
  {
    id: id(),
    workspaceId: workspaceRef(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    url: text('url'),
    secretReference: text('secret_reference'),
    events: text('events').array().notNull().default([]),
    minSeverity: severityEnum('min_severity').notNull().default('low'),
    enabled: boolean('enabled').notNull().default(true),
    lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('notification_channels_workspace_idx').on(t.workspaceId)],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: id(),
    workspaceId: workspaceRef(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => notificationChannels.id, { onDelete: 'cascade' }),
    eventKey: text('event_key').notNull(),
    eventType: text('event_type').notNull(),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(1),
    responseStatus: integer('response_status'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('notification_deliveries_key').on(t.channelId, t.eventKey),
    index('notification_deliveries_workspace_idx').on(t.workspaceId, t.createdAt),
  ],
);

export const deliveryAttempts = pgTable(
  'delivery_attempts',
  {
    id: id(),
    workspaceId: workspaceRef(),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'set null' }),
    runId: uuid('run_id').references(() => escalationRuns.id, { onDelete: 'set null' }),
    stepIndex: integer('step_index'),
    channelId: uuid('channel_id').references(() => notificationChannels.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    dedupKey: text('dedup_key').notNull(),
    eventType: text('event_type').notNull(),
    channel: text('channel').notNull(),
    address: text('address').notNull(),
    recipientName: text('recipient_name'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    state: text('state').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow(),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    providerMessageId: text('provider_message_id'),
    responseStatus: integer('response_status'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('delivery_attempts_dedup_key').on(t.dedupKey),
    index('delivery_attempts_due_idx').on(t.state, t.nextAttemptAt),
    index('delivery_attempts_workspace_idx').on(t.workspaceId, t.createdAt),
    index('delivery_attempts_incident_idx').on(t.incidentId),
    index('delivery_attempts_run_idx').on(t.runId),
    index('delivery_attempts_provider_idx').on(t.providerMessageId),
  ],
);

export const contactMethods = pgTable(
  'contact_methods',
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    address: text('address').notNull(),
    minSeverity: severityEnum('min_severity').notNull().default('low'),
    ...timestamps(),
  },
  (t) => [index('contact_methods_user_idx').on(t.workspaceId, t.userId)],
);
