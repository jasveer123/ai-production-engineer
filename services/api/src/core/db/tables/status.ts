import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { workspaceRef } from './identity-and-tenancy';
import { integrations } from './integrations-and-services';
import { id, timestamps } from './helpers';

export const statusPages = pgTable(
  'status_pages',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('status_pages_slug_idx').on(t.slug),
    index('status_pages_workspace_idx').on(t.workspaceId),
  ],
);

export const statusPageMonitors = pgTable(
  'status_page_monitors',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.monitorId] })],
);

export const statusUpdates = pgTable(
  'status_updates',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    state: text('state').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('status_updates_page_idx').on(t.pageId, t.createdAt)],
);
