import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { type SandboxProfile } from './types';
import { integrationStatusEnum } from './enums';
import { id, timestamps } from './helpers';
import { workspaceRef } from './identity-and-tenancy';

export const integrations = pgTable(
  'integrations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    provider: text('provider').notNull(),
    name: text('name').notNull().default(''),
    externalAccountId: text('external_account_id'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    status: integrationStatusEnum('status').notNull().default('pending'),

    secretReference: text('secret_reference'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps(),
  },
  (t) => [index('integrations_workspace_idx').on(t.workspaceId)],
);

export const services = pgTable(
  'services',
  {
    id: id(),
    workspaceId: workspaceRef(),
    name: text('name').notNull(),
    environment: text('environment').notNull(),
    repositoryFullName: text('repository_full_name'),
    defaultBranch: text('default_branch').notNull().default('main'),

    sandbox: jsonb('sandbox').$type<SandboxProfile | null>(),
    integrationId: uuid('integration_id').references(() => integrations.id, {
      onDelete: 'set null',
    }),

    valuePerRequest: numeric('value_per_request', { precision: 14, scale: 4 }),
    valueCurrency: text('value_currency'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('services_name_env_key').on(t.workspaceId, t.name, t.environment)],
);
