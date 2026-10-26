import { timestamp, uuid } from 'drizzle-orm/pg-core';

// Every table gets a UUID id and created_at/updated_at. Tenant-owned tables carry workspace_id.
export const id = () => uuid('id').primaryKey().defaultRandom();
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
