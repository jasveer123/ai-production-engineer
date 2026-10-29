import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { id, timestamps } from './helpers';

export const ingestTokens = pgTable(
  'ingest_tokens',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    last4: text('last4').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('ingest_tokens_hash_key').on(t.tokenHash),
    index('ingest_tokens_workspace_idx').on(t.workspaceId),
  ],
);

export const logRecords = pgTable(
  'log_records',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    service: text('service').notNull(),
    environment: text('environment').notNull(),
    level: text('level').notNull(),
    message: text('message').notNull(),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    host: text('host'),

    way: text('way').notNull(),

    dedupKey: text('dedup_key'),
  },
  (t) => [
    index('log_records_workspace_ts_idx').on(t.workspaceId, t.ts),
    index('log_records_service_ts_idx').on(t.workspaceId, t.service, t.ts),
    index('log_records_trace_idx').on(t.workspaceId, t.traceId),
    uniqueIndex('log_records_dedup_key')
      .on(t.workspaceId, t.dedupKey)
      .where(sql`${t.dedupKey} is not null`),
  ],
);

export const spans = pgTable(
  'spans',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    traceId: text('trace_id').notNull(),
    spanId: text('span_id').notNull(),
    parentSpanId: text('parent_span_id'),
    service: text('service').notNull(),
    environment: text('environment').notNull(),
    name: text('name').notNull(),
    kind: integer('kind').notNull().default(0),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    durationMs: numeric('duration_ms', { precision: 14, scale: 3 }).notNull(),
    statusCode: integer('status_code').notNull().default(0),
    statusMessage: text('status_message'),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    events: jsonb('events').$type<SpanEvent[]>().notNull().default([]),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('spans_key').on(t.workspaceId, t.traceId, t.spanId),
    index('spans_workspace_time_idx').on(t.workspaceId, t.startTime),
  ],
);

export interface SpanEvent {
  name: string;
  time: string;
  attributes: Record<string, unknown>;
}

export const ingestStreams = pgTable(
  'ingest_streams',
  {
    id: id(),
    workspaceId: workspaceRef(),
    way: text('way').notNull(),
    serviceName: text('service_name').notNull(),
    environment: text('environment').notNull(),
    host: text('host'),
    firstReceivedAt: timestamp('first_received_at', { withTimezone: true }).notNull(),
    lastReceivedAt: timestamp('last_received_at', { withTimezone: true }).notNull(),
    logCount: bigint('log_count', { mode: 'number' }).notNull().default(0),
    spanCount: bigint('span_count', { mode: 'number' }).notNull().default(0),
    errorCount: bigint('error_count', { mode: 'number' }).notNull().default(0),
    metricCount: bigint('metric_count', { mode: 'number' }).notNull().default(0),
    ...timestamps(),
  },
  (t) => [uniqueIndex('ingest_streams_key').on(t.workspaceId, t.way, t.serviceName, t.environment)],
);
