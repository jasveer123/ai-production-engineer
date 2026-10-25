import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import type {
  CreateIntegrationInput,
  Integration,
  IntegrationWithSecret,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { integrations } from '../db/schema';
import { githubScope } from '../github/github-config';
import { SecretStore } from '../secrets/secret-store.service';
import { IntegrationHealth } from './integration-health.service';

type Row = typeof integrations.$inferSelect;

const SCOPES: Record<string, string> = {
  deploy_webhook: 'Receives signed deploy events. Has no access to your systems.',
  otel_jaeger: 'Reads error traces for this workspace’s mapped services from Jaeger.',
};

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
    private readonly health: IntegrationHealth,
  ) {}

  toDto(r: Row): Integration {
    return {
      id: r.id,
      provider: r.provider,
      name: r.name,
      status: r.status,
      scope: SCOPES[r.provider] ?? '',
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      lastError: r.lastError,
      webhookUrl:
        r.provider === 'deploy_webhook'
          ? `${this.env.PUBLIC_API_URL}/ingest/deploys/${r.id}`
          : null,
      createdAt: r.createdAt.toISOString(),
      ...(r.provider === 'github' ? githubScope(r) : {}),
    };
  }

  private async find(actor: ActorContext, id: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Integration');
    return row;
  }

  private record(
    actor: ActorContext,
    action: string,
    id: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'integration',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }

  async list(actor: ActorContext): Promise<Integration[]> {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          // Alert sources, log readers and the internal ingest owner have their own pages.
          notInArray(integrations.provider, [
            'alert_source',
            'log_reader',
            'ingest',
            'sentry_app',
            'heroku_oauth',
            'aws_setup',
          ]),
        ),
      )
      .orderBy(asc(integrations.createdAt));
    return rows.map((r) => this.toDto(r));
  }

  async create(actor: ActorContext, input: CreateIntegrationInput): Promise<IntegrationWithSecret> {
    if (input.provider === 'github') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'use_github_connect',
        'Connect GitHub with POST /github/connect',
      );
    }
    if (input.provider === 'deploy_webhook') {
      const secret = `whsec_${randomBytes(32).toString('hex')}`;
      const row = await this.db.transaction(async (tx) => {
        const secretReference = await this.secrets.put(actor.workspaceId, secret, tx);
        const [r] = await tx
          .insert(integrations)
          .values({
            workspaceId: actor.workspaceId,
            provider: input.provider,
            name: input.name,
            secretReference,
          })
          .returning();
        return r!;
      });
      await this.record(actor, 'integration.created', row.id, { provider: input.provider });
      return { ...this.toDto(row), signingSecret: secret };
    }

    const [row] = await this.db
      .insert(integrations)
      .values({ workspaceId: actor.workspaceId, provider: input.provider, name: input.name })
      .returning();
    await this.record(actor, 'integration.created', row!.id, { provider: input.provider });
    return { ...(await this.test(actor, row!.id)), signingSecret: null };
  }

  /** Re-validates the connection. Only a successful check marks it connected (FR-02). */
  async test(actor: ActorContext, id: string): Promise<Integration> {
    const row = await this.find(actor, id);
    if (row.status === 'disconnected') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'disconnected',
        'Reconnect by creating a new integration',
      );
    }
    if (row.provider === 'github' || row.provider === 'otel_jaeger') {
      const updated = await this.health.check(row);
      await this.record(actor, 'integration.tested', id, { status: updated.status });
      return this.toDto(updated);
    }
    return this.toDto(row);
  }

  async rotateSecret(actor: ActorContext, id: string): Promise<IntegrationWithSecret> {
    const row = await this.find(actor, id);
    if (row.provider !== 'deploy_webhook' || row.status === 'disconnected') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'not_rotatable',
        'Only active webhooks have a signing secret',
      );
    }
    const secret = `whsec_${randomBytes(32).toString('hex')}`;
    const updated = await this.db.transaction(async (tx) => {
      const secretReference = await this.secrets.put(actor.workspaceId, secret, tx);
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
      const [r] = await tx
        .update(integrations)
        .set({ secretReference })
        .where(eq(integrations.id, id))
        .returning();
      return r!;
    });
    await this.record(actor, 'integration.secret_rotated', id);
    return { ...this.toDto(updated), signingSecret: secret };
  }

  /** Revocation: deletes the secret so no further events are accepted. */
  async disconnect(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db.transaction(async (tx) => {
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
      await tx
        .update(integrations)
        .set({ status: 'disconnected', secretReference: null, lastError: null })
        .where(eq(integrations.id, id));
    });
    await this.record(actor, 'integration.disconnected', id, { provider: row.provider });
  }
}
