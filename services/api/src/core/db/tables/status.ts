import {
  boolean,
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
    customDomain: text('custom_domain'),
    domainToken: text('domain_token'),
    domainVerifiedAt: timestamp('domain_verified_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('status_pages_slug_idx').on(t.slug),
    uniqueIndex('status_pages_domain_idx').on(t.customDomain),
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
    lastState: text('last_state'),
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
    auto: boolean('auto').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('status_updates_page_idx').on(t.pageId, t.createdAt)],
);

export const statusSubscribers = pgTable(
  'status_subscribers',
  {
    id: id(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('status_subscribers_email_idx').on(t.pageId, t.email),
    uniqueIndex('status_subscribers_token_idx').on(t.token),
  ],
);
