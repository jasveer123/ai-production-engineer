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
    logoUrl: text('logo_url'),
    logoDarkUrl: text('logo_dark_url'),
    homepageUrl: text('homepage_url'),
    contactUrl: text('contact_url'),
    theme: text('theme').notNull().default('system'),
    headerLayout: text('header_layout').notNull().default('logo_and_name'),
    passwordHash: text('password_hash'),
    hideFromSearch: boolean('hide_from_search').notNull().default(false),
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
    reportId: uuid('report_id').references(() => statusReports.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('status_updates_page_idx').on(t.pageId, t.createdAt),
    index('status_updates_report_idx').on(t.reportId, t.createdAt),
  ],
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
    confirmExpiresAt: timestamp('confirm_expires_at', { withTimezone: true }),
    unsubscribeToken: text('unsubscribe_token'),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('status_subscribers_email_idx').on(t.pageId, t.email),
    uniqueIndex('status_subscribers_token_idx').on(t.token),
    uniqueIndex('status_subscribers_unsubscribe_idx').on(t.unsubscribeToken),
  ],
);

export const statusSections = pgTable(
  'status_sections',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default(''),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('status_sections_page_idx').on(t.pageId, t.position)],
);

export const statusResources = pgTable(
  'status_resources',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    sectionId: uuid('section_id').references(() => statusSections.id, { onDelete: 'set null' }),
    publicName: text('public_name').notNull(),
    explanation: text('explanation'),
    position: integer('position').notNull().default(0),
    showHistory: boolean('show_history').notNull().default(true),
    manualState: text('manual_state'),
    state: text('state').notNull().default('unknown'),
    stateChangedAt: timestamp('state_changed_at', { withTimezone: true }),
  },
  (t) => [index('status_resources_page_idx').on(t.pageId, t.position)],
);

export const statusResourceMonitors = pgTable(
  'status_resource_monitors',
  {
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => statusResources.id, { onDelete: 'cascade' }),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.resourceId, t.monitorId] }),
    index('status_resource_monitors_monitor_idx').on(t.monitorId),
  ],
);

export const statusReports = pgTable(
  'status_reports',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    state: text('state').notNull().default('investigating'),
    auto: boolean('auto').notNull().default(false),
    monitorId: uuid('monitor_id').references(() => integrations.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('status_reports_page_idx').on(t.pageId, t.publishedAt),
    index('status_reports_open_auto_idx').on(t.pageId, t.monitorId, t.resolvedAt),
  ],
);

export const statusReportResources = pgTable(
  'status_report_resources',
  {
    reportId: uuid('report_id')
      .notNull()
      .references(() => statusReports.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => statusResources.id, { onDelete: 'cascade' }),
    impact: text('impact').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reportId, t.resourceId] }),
    index('status_report_resources_resource_idx').on(t.resourceId),
  ],
);

export const statusMaintenances = pgTable(
  'status_maintenances',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    notify: boolean('notify').notNull().default(true),
    startNotifiedAt: timestamp('start_notified_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('status_maintenances_page_idx').on(t.pageId, t.startsAt)],
);

export const statusMaintenanceResources = pgTable(
  'status_maintenance_resources',
  {
    maintenanceId: uuid('maintenance_id')
      .notNull()
      .references(() => statusMaintenances.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => statusResources.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.maintenanceId, t.resourceId] }),
    index('status_maintenance_resources_resource_idx').on(t.resourceId),
  ],
);

export const statusNotifications = pgTable(
  'status_notifications',
  {
    id: id(),
    workspaceId: workspaceRef(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => statusPages.id, { onDelete: 'cascade' }),
    dedupKey: text('dedup_key').notNull(),
    reportId: uuid('report_id').references(() => statusReports.id, { onDelete: 'set null' }),
    maintenanceId: uuid('maintenance_id').references(() => statusMaintenances.id, {
      onDelete: 'set null',
    }),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    deliverAfter: timestamp('deliver_after', { withTimezone: true }).notNull().defaultNow(),
    fannedOutAt: timestamp('fanned_out_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('status_notifications_dedup_idx').on(t.pageId, t.dedupKey),
    index('status_notifications_pending_idx').on(t.fannedOutAt, t.deliverAfter),
  ],
);

export const statusDeliveries = pgTable(
  'status_deliveries',
  {
    id: id(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => statusNotifications.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => statusSubscribers.id, { onDelete: 'cascade' }),
    state: text('state').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('status_deliveries_once_idx').on(t.notificationId, t.subscriberId),
    index('status_deliveries_due_idx').on(t.state, t.nextAttemptAt),
  ],
);
