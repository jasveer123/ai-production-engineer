import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { id, timestamps } from './helpers';

export const savedQueries = pgTable(
  'saved_queries',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    signal: text('signal').notNull(),
    query: text('query').notNull().default(''),
    range: text('range').notNull().default('1h'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('saved_queries_workspace_idx').on(t.workspaceId, t.signal)],
);
