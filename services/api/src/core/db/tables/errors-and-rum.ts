import {
  bigserial,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { workspaceRef } from './identity-and-tenancy';
import { id } from './helpers';
import { rumApplications } from './telemetry-ingest';

export const errorApplications = pgTable(
  'error_applications',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('javascript'),
    publicKey: text('public_key').notNull(),
    projectId: serial('project_id').notNull(),
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(600),
    droppedEvents: integer('dropped_events').notNull().default(0),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('error_applications_key_idx').on(t.publicKey),
    uniqueIndex('error_applications_project_idx').on(t.projectId),
    index('error_applications_workspace_idx').on(t.workspaceId),
  ],
);

export const ingestRateWindows = pgTable(
  'ingest_rate_windows',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull().default(0),
  },
  (t) => [
    uniqueIndex('ingest_rate_windows_key_idx').on(t.key, t.windowStart),
    index('ingest_rate_windows_start_idx').on(t.windowStart),
  ],
);

export const rumBatches = pgTable(
  'rum_batches',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    appId: uuid('app_id')
      .notNull()
      .references(() => rumApplications.id, { onDelete: 'cascade' }),
    batchId: text('batch_id').notNull(),
    sessionKey: text('session_key').notNull(),
    sequence: integer('sequence').notNull().default(0),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('rum_batches_batch_idx').on(t.appId, t.batchId),
    index('rum_batches_received_idx').on(t.receivedAt),
  ],
);
