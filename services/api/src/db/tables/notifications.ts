import {
  boolean,
  index,
  integer,
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

/**
 * Where incident notifications go. A Slack webhook URL is itself a credential, so it lives in the
 * secret store; a generic webhook keeps its URL here and its HMAC signing secret in the store.
 */
export const notificationChannels = pgTable(
  'notification_channels',
  {
    id: id(),
    workspaceId: workspaceRef(),
    kind: text('kind').notNull(), // slack | webhook
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

/** One row per (channel, event): a retried outbox row never notifies a channel twice. */
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
    status: text('status').notNull(), // sent | failed
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
