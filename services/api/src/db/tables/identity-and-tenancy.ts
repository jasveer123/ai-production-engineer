import { sql } from 'drizzle-orm';
import {
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
import { WorkspaceSettings } from './types';
import { roleEnum, workspaceStatusEnum } from './enums';
import { id, timestamps } from './helpers';

export const workspaceRef = () =>
  uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' });

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    avatarUrl: text('avatar_url'),
    identityProvider: text('identity_provider').notNull(),
    identityProviderId: text('identity_provider_id').notNull(),
    /** scrypt hash (`scrypt$N$r$p$salt$hash`); null for accounts that only use GitHub or dev login. */
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    uniqueIndex('users_identity_key').on(t.identityProvider, t.identityProviderId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  status: workspaceStatusEnum('status').notNull().default('active'),
  settings: jsonb('settings').$type<WorkspaceSettings>().notNull().default({}),
  /** FR-16 limits checked before any investigation starts. Null means no limit. */
  aiBudgetUsd: numeric('ai_budget_usd', { precision: 12, scale: 2 }),
  maxConcurrentInvestigations: integer('max_concurrent_investigations'),
  ...timestamps(),
});

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('workspace_members_key').on(t.workspaceId, t.userId),
    index('workspace_members_user_idx').on(t.userId),
  ],
);

export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    email: text('email').notNull(),
    role: roleEnum('role').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** SHA-256 of the invite link token. The link proves the invitee controls the email. */
    tokenHash: text('token_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('workspace_invitations_email_idx').on(sql`lower(${t.email})`),
    uniqueIndex('workspace_invitations_token_key').on(t.tokenHash),
  ],
);

/** Single-use, expiring links (password reset, email verification). Only the hash is stored. */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // password_reset | email_verify
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('auth_tokens_hash_key').on(t.tokenHash),
    index('auth_tokens_user_idx').on(t.userId, t.kind),
  ],
);
