import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { ToolId } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import type { Database } from '../db/client';
import { DB } from '../db/database.module';
import { integrations } from '../db/schema';
import { SecretStore } from '../secrets/secret-store.service';
import type { FetchFn } from '../tools/readers';
import { fetchGitHubJwks, type JwksFetcher } from './github-oidc';
import { ProvisionError } from './provisioners';

/** Integration rows owned by the setup flows; hidden from the integrations list. */
export const SETUP_PROVIDERS = ['sentry_app', 'heroku_oauth', 'aws_setup'] as const;

export const setupFailed = (err: unknown) =>
  new ApiException(
    HttpStatus.BAD_GATEWAY,
    'setup_failed',
    err instanceof ProvisionError ? err.message : `Setup failed: ${(err as Error).message}`,
  );

export interface SetupRowInput {
  provider: (typeof SETUP_PROVIDERS)[number];
  name: string;
  config: Record<string, unknown>;
  secrets?: Record<string, string>;
  externalId?: string;
}

/** Shared by the setup services: audit trail, hidden setup rows and the swappable HTTP clients. */
@Injectable()
export class SetupSupport {
  /** Swappable in tests. */
  fetchFn: FetchFn = (...args) => fetch(...args);
  jwks: JwksFetcher = fetchGitHubJwks;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly secrets: SecretStore,
  ) {}

  record(actor: ActorContext, action: string, metadata: Record<string, unknown>) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'setup',
      resourceId: typeof metadata.target === 'string' ? metadata.target : null,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }

  auditRejectedDeploy(correlationId: string, reason: string) {
    return this.audit.record({
      actorType: 'system',
      action: 'deploy.rejected',
      resourceType: 'deploy',
      outcome: 'denied',
      correlationId,
      metadata: { reason },
    });
  }

  /** One hidden row per provider and workspace (replaced on reconnect). */
  async saveRow(actor: ActorContext, input: SetupRowInput): Promise<void> {
    const { provider, name, config, secrets = {}, externalId } = input;
    const ref = Object.keys(secrets).length
      ? await this.secrets.put(actor.workspaceId, JSON.stringify(secrets))
      : null;
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, provider),
          ne(integrations.status, 'disconnected'),
        ),
      );
    await this.db.insert(integrations).values({
      workspaceId: actor.workspaceId,
      provider,
      name,
      config,
      secretReference: ref,
      externalAccountId: externalId ?? null,
      status: 'connected',
      lastSyncAt: new Date(),
    });
  }

  async patchReaderSecrets(
    workspaceId: string,
    tool: ToolId,
    secrets: Record<string, string>,
    settings: Record<string, string>,
  ): Promise<void> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, 'log_reader'),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'tool' = ${tool}`,
        ),
      );
    if (!row) return;
    const ref = await this.secrets.put(workspaceId, JSON.stringify(secrets));
    if (row.secretReference) await this.secrets.delete(workspaceId, row.secretReference);
    const cfg = row.config as { settings: Record<string, string> };
    await this.db
      .update(integrations)
      .set({
        secretReference: ref,
        config: { ...row.config, settings: { ...cfg.settings, ...settings } },
      })
      .where(eq(integrations.id, row.id));
  }

  async herokuToken(actor: ActorContext): Promise<string> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'heroku_oauth'),
          ne(integrations.status, 'disconnected'),
        ),
      );
    const raw = row?.secretReference
      ? await this.secrets.get(actor.workspaceId, row.secretReference)
      : null;
    if (!raw)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'heroku_not_connected',
        'Sign in with Heroku or paste an API key first',
      );
    return (JSON.parse(raw) as { token: string }).token;
  }

  /** Routes a signed Sentry app webhook to the installing workspace's alert source. */
  async sentryWebhookTarget(
    installationUuid: string,
  ): Promise<{ workspaceId: string; alertSourceId: string | null; rowId: string } | null> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'sentry_app'),
          eq(integrations.externalAccountId, installationUuid),
          ne(integrations.status, 'disconnected'),
        ),
      );
    if (!row) return null;
    return {
      workspaceId: row.workspaceId,
      alertSourceId: (row.config as { alertSourceId?: string }).alertSourceId ?? null,
      rowId: row.id,
    };
  }

  async sentryUninstalled(rowId: string): Promise<void> {
    await this.db
      .update(integrations)
      .set({ status: 'disconnected', lastError: 'Uninstalled in Sentry' })
      .where(eq(integrations.id, rowId));
  }
}
