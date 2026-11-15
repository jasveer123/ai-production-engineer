import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const workerHeartbeats = pgTable('worker_heartbeats', {
  name: text('name').primaryKey(),
  host: text('host'),
  pid: integer('pid'),
  beatAt: timestamp('beat_at', { withTimezone: true }).notNull().defaultNow(),
});
