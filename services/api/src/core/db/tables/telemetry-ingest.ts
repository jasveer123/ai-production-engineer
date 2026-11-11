import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
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
    platform: text('platform'),
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

export const metricPoints = pgTable(
  'metric_points',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    service: text('service').notNull(),
    environment: text('environment').notNull(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    unit: text('unit'),
    value: doublePrecision('value').notNull(),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('metric_points_name_ts_idx').on(t.workspaceId, t.name, t.ts),
    index('metric_points_ts_idx').on(t.ts),
  ],
);

export const dashboards = pgTable(
  'dashboards',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    widgets: jsonb('widgets').$type<Record<string, unknown>[]>().notNull().default([]),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('dashboards_workspace_idx').on(t.workspaceId)],
);

export const errorGroups = pgTable(
  'error_groups',
  {
    id: id(),
    workspaceId: workspaceRef(),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    errorType: text('error_type').notNull(),
    message: text('message').notNull(),
    service: text('service').notNull(),
    environment: text('environment').notNull(),
    status: text('status').notNull().default('unresolved'),
    count: integer('count').notNull().default(0),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    release: text('release'),
    route: text('route'),
    stack: jsonb('stack').$type<string[]>().notNull().default([]),
    incidentId: uuid('incident_id'),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    firstRelease: text('first_release'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('error_groups_fingerprint_idx').on(t.workspaceId, t.fingerprint),
    index('error_groups_last_seen_idx').on(t.workspaceId, t.lastSeenAt),
  ],
);

export const errorOccurrences = pgTable(
  'error_occurrences',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => errorGroups.id, { onDelete: 'cascade' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    traceId: text('trace_id'),
    release: text('release'),
    message: text('message').notNull(),
    externalEventId: text('external_event_id'),
  },
  (t) => [
    index('error_occurrences_group_idx').on(t.groupId, t.occurredAt),
    uniqueIndex('error_occurrences_event_idx')
      .on(t.groupId, t.externalEventId)
      .where(sql`${t.externalEventId} is not null`),
  ],
);

export const sourceMaps = pgTable(
  'source_maps',
  {
    id: id(),
    workspaceId: workspaceRef(),
    release: text('release').notNull(),
    file: text('file').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('source_maps_unique_idx').on(t.workspaceId, t.release, t.file)],
);

export const rumApplications = pgTable(
  'rum_applications',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    appKey: text('app_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rum_applications_key_idx').on(t.appKey)],
);

export const rumSessions = pgTable(
  'rum_sessions',
  {
    id: id(),
    workspaceId: workspaceRef(),
    appId: uuid('app_id')
      .notNull()
      .references(() => rumApplications.id, { onDelete: 'cascade' }),
    sessionKey: text('session_key').notNull(),
    userId: text('user_id'),
    userName: text('user_name'),
    userEmail: text('user_email'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    pageViews: integer('page_views').notNull().default(0),
    errors: integer('errors').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    entryUrl: text('entry_url'),
    browser: text('browser'),
    os: text('os'),
    device: text('device'),
    hasReplay: boolean('has_replay').notNull().default(false),
    viewportW: integer('viewport_w'),
    viewportH: integer('viewport_h'),
  },
  (t) => [
    uniqueIndex('rum_sessions_key_idx').on(t.appId, t.sessionKey),
    index('rum_sessions_time_idx').on(t.workspaceId, t.lastSeenAt),
  ],
);

export const rumEvents = pgTable(
  'rum_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    appId: uuid('app_id').notNull(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => rumSessions.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    type: text('type').notNull(),
    name: text('name').notNull().default(''),
    url: text('url'),
    value: doublePrecision('value'),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('rum_events_session_idx').on(t.sessionId, t.ts),
    index('rum_events_app_time_idx').on(t.workspaceId, t.type, t.ts),
  ],
);

export const rumReplay = pgTable(
  'rum_replay',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => rumSessions.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull(),
    kind: text('kind').notNull(),
    html: text('html'),
    url: text('url'),
    moves: jsonb('moves').$type<{ ts: number; t: string; x: number; y: number }[]>(),
  },
  (t) => [index('rum_replay_session_idx').on(t.sessionId, t.ts)],
);

export const rumFunnels = pgTable(
  'rum_funnels',
  {
    id: id(),
    workspaceId: workspaceRef(),
    appId: uuid('app_id')
      .notNull()
      .references(() => rumApplications.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    steps: jsonb('steps').$type<{ kind: string; match: string; label?: string }[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('rum_funnels_workspace_idx').on(t.workspaceId)],
);
