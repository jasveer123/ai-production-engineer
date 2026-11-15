import { bigserial, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { integrations } from './integrations-and-services';
import { workspaceRef } from './identity-and-tenancy';

export const heartbeatPings = pgTable(
  'heartbeat_pings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: workspaceRef(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    signal: text('signal').notNull(),
    outcome: text('outcome').notNull(),
    executionId: text('execution_id'),
    durationMs: integer('duration_ms'),
    body: text('body'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('heartbeat_pings_source_time_idx').on(t.sourceId, t.receivedAt),
    index('heartbeat_pings_received_idx').on(t.receivedAt),
  ],
);
