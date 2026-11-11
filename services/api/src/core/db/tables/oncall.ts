import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { id, timestamps } from './helpers';

export const oncallSchedules = pgTable(
  'oncall_schedules',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    rotationHours: integer('rotation_hours').notNull().default(168),
    anchorAt: timestamp('anchor_at', { withTimezone: true }).notNull(),
    participants: jsonb('participants').$type<string[]>().notNull().default([]),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('oncall_schedules_workspace_idx').on(t.workspaceId)],
);

export const oncallOverrides = pgTable(
  'oncall_overrides',
  {
    id: id(),
    workspaceId: workspaceRef(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => oncallSchedules.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [index('oncall_overrides_schedule_idx').on(t.scheduleId, t.startsAt)],
);
