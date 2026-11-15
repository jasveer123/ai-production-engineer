import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import type {
  AlertSource,
  AlertSourceKind,
  AlertSourceWithToken,
  CreateAlertSourceInput,
  HeartbeatDetail,
  UpdateAlertSourceInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { escalationPolicies, integrations } from '../../../core/db/schema';
import { SecretStore } from '../../../core/secrets/secret-store.service';
import { hasRole } from '../../workspaces/domain/roles';
import { setPaused } from '../domain/heartbeat';
import { bufferAlertEvent, type BufferResult } from './alert-buffer';
import {
  ALERT_SOURCE_PROVIDER,
  heartbeatStatus,
  HeartbeatsService,
  type HeartbeatSourceConfig,
} from './heartbeats.service';

export { ALERT_SOURCE_PROVIDER };
type Row = typeof integrations.$inferSelect;

export type SourceConfig =
  | HeartbeatSourceConfig
  | { kind: Exclude<AlertSourceKind, 'heartbeat'>; escalationPolicyId?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newToken = () => `ape_alert_${randomBytes(24).toString('hex')}`;

const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

@Injectable()
export class AlertSourcesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
    private readonly heartbeats: HeartbeatsService,
  ) {}

  toDto(r: Row): AlertSource {
    const cfg = r.config as unknown as SourceConfig;
    return {
      id: r.id,
      kind: cfg.kind,
      name: r.name,
      status: r.status,
      url: `${this.env.PUBLIC_API_URL}/ingest/${cfg.kind === 'heartbeat' ? 'heartbeats' : 'alerts'}/${r.id}`,
      lastReceivedAt: r.lastSyncAt?.toISOString() ?? null,
      lastError: r.lastError,
      escalationPolicyId: cfg.escalationPolicyId ?? null,
      heartbeat: cfg.kind === 'heartbeat' ? heartbeatStatus(cfg) : null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async find(actor: ActorContext, id: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, id),
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
        ),
      );
    if (!row) throw notFound('Alert source');
    return row;
  }

  private record(actor: ActorContext, action: string, id: string, metadata = {}) {
    const { workspaceId, userId: actorId, correlationId } = actor;
    const base = { resourceType: 'alert_source', outcome: 'success' } as const;
    return this.audit.record({
      ...base,
      workspaceId,
      actorId,
      action,
      resourceId: id,
      correlationId,
      metadata,
    });
  }

  async list(actor: ActorContext): Promise<AlertSource[]> {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
        ),
      )
      .orderBy(asc(integrations.createdAt));
    return rows.map((r) => this.toDto(r));
  }

  private async checkPolicy(actor: ActorContext, id: string | null | undefined) {
    if (!id) return;
    const [found] = await this.db
      .select({ id: escalationPolicies.id })
      .from(escalationPolicies)
      .where(
        and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
      );
    if (!found) throw notFound('Escalation policy');
  }

  async create(actor: ActorContext, input: CreateAlertSourceInput): Promise<AlertSourceWithToken> {
    await this.checkPolicy(actor, input.escalationPolicyId);
    const token = newToken();
    const escalationPolicyId = input.escalationPolicyId ?? null;
    const config: SourceConfig =
      input.kind === 'heartbeat'
        ? {
            kind: 'heartbeat',
            intervalSeconds: input.intervalSeconds,
            graceSeconds: input.graceSeconds ?? 60,
            state: 'pending',
            paused: false,
            lastPingAt: null,
            windowStartAt: null,
            metadata: input.metadata ?? {},
            escalationPolicyId,
          }
        : { kind: input.kind, escalationPolicyId };
    const row = await this.db.transaction(async (tx) => {
      const secretReference = await this.secrets.put(actor.workspaceId, token, tx);
      const [r] = await tx
        .insert(integrations)
        .values({
          workspaceId: actor.workspaceId,
          provider: ALERT_SOURCE_PROVIDER,
          name: input.name,
          config: config as unknown as Record<string, unknown>,
          secretReference,
        })
        .returning();
      return r!;
    });
    await this.record(actor, 'alert_source.created', row.id, { kind: input.kind });
    return { ...this.toDto(row), token };
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateAlertSourceInput,
  ): Promise<AlertSource> {
    await this.find(actor, id);
    await this.checkPolicy(actor, input.escalationPolicyId);
    const row = await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(integrations)
        .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)))
        .for('update');
      const cfg = this.patchConfig(locked!.config as unknown as SourceConfig, input);
      const [r] = await tx
        .update(integrations)
        .set({
          ...(input.name ? { name: input.name } : {}),
          config: cfg as unknown as Record<string, unknown>,
        })
        .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)))
        .returning();
      return r!;
    });
    await this.record(actor, 'alert_source.updated', id, { changes: Object.keys(input) });
    return this.toDto(row);
  }

  private patchConfig(current: SourceConfig, input: UpdateAlertSourceInput): SourceConfig {
    const escalationPolicyId =
      input.escalationPolicyId !== undefined
        ? input.escalationPolicyId
        : current.escalationPolicyId;
    if (current.kind !== 'heartbeat') return { ...current, escalationPolicyId };
    const next: HeartbeatSourceConfig = {
      ...current,
      escalationPolicyId,
      intervalSeconds: input.intervalSeconds ?? current.intervalSeconds,
      graceSeconds: input.graceSeconds ?? current.graceSeconds,
      metadata: input.metadata ?? current.metadata ?? {},
    };
    if (input.paused === undefined || input.paused === Boolean(current.paused)) return next;
    return { ...next, ...setPaused(next, input.paused, new Date()) };
  }

  async heartbeatDetail(actor: ActorContext, id: string): Promise<HeartbeatDetail> {
    const row = await this.find(actor, id);
    if ((row.config as unknown as SourceConfig).kind !== 'heartbeat') throw notFound('Heartbeat');
    const source = this.toDto(row);
    const secret =
      hasRole(actor.role, 'engineer') && row.secretReference
        ? await this.secrets.get(actor.workspaceId, row.secretReference)
        : undefined;
    return {
      source,
      pingUrl: secret ? `${source.url}/${secret}` : null,
      pings: await this.heartbeats.pings(actor.workspaceId, id),
    };
  }

  async rotate(actor: ActorContext, id: string): Promise<AlertSourceWithToken> {
    const row = await this.find(actor, id);
    if (row.status === 'disconnected') throw notFound('Alert source');
    const token = newToken();
    const updated = await this.db.transaction(async (tx) => {
      const secretReference = await this.secrets.put(actor.workspaceId, token, tx);
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
      const [r] = await tx
        .update(integrations)
        .set({ secretReference })
        .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)))
        .returning();
      return r!;
    });
    await this.record(actor, 'alert_source.token_rotated', id);
    return { ...this.toDto(updated), token };
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db.transaction(async (tx) => {
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
      await tx
        .update(integrations)
        .set({ status: 'disconnected', secretReference: null })
        .where(and(eq(integrations.id, id), eq(integrations.workspaceId, actor.workspaceId)));
    });
    await this.record(actor, 'alert_source.disconnected', id);
  }

  async authenticate(sourceId: string, token: string | undefined): Promise<Row | null> {
    if (!token || !UUID.test(sourceId)) return null;
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, sourceId),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
        ),
      );
    if (!row?.secretReference) return null;
    const secret = await this.secrets.get(row.workspaceId, row.secretReference);
    return secret && sameToken(secret, token) ? row : null;
  }

  async row(id: string): Promise<Row | null> {
    const [r] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, id),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
        ),
      );
    return r ?? null;
  }

  async receive(
    row: Row,
    externalEventId: string,
    payload: Record<string, unknown>,
    rejectedReason?: string,
  ): Promise<BufferResult> {
    const kind = (row.config as unknown as SourceConfig).kind;
    const result = await bufferAlertEvent(
      this.db,
      { id: row.id, workspaceId: row.workspaceId, kind },
      { externalEventId, payload, rejectedReason },
    );
    await this.db
      .update(integrations)
      .set(
        rejectedReason
          ? {
              lastSyncAt: new Date(),
              lastError: `Rejected an event: ${rejectedReason}`.slice(0, 500),
            }
          : { status: 'connected', lastSyncAt: new Date(), lastError: null },
      )
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
    return result;
  }

  async buffer(
    row: Row,
    externalEventId: string,
    payload: Record<string, unknown>,
    received = true,
  ): Promise<boolean> {
    if (received) return (await this.receive(row, externalEventId, payload)).duplicate;
    const target = {
      id: row.id,
      workspaceId: row.workspaceId,
      kind: (row.config as unknown as SourceConfig).kind,
    };
    return (await bufferAlertEvent(this.db, target, { externalEventId, payload })).duplicate;
  }

  async confirmSnsSubscription(row: Row, sns: Record<string, unknown>): Promise<void> {
    const raw = typeof sns.SubscribeURL === 'string' ? sns.SubscribeURL : '';
    let target: URL | null = null;
    try {
      target = new URL(raw);
    } catch {
      target = null;
    }
    const ok =
      target?.protocol === 'https:' &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(target.hostname) &&
      target.searchParams.get('Action') === 'ConfirmSubscription';
    let error: string | null = null;
    if (!ok) error = 'SNS sent a subscription URL that is not an AWS SNS endpoint';
    else {
      try {
        const res = await fetch(target!, {
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
        });
        if (!res.ok) error = `SNS subscription confirmation failed (HTTP ${res.status})`;
      } catch (err) {
        error = `SNS subscription confirmation failed: ${(err as Error).message}`;
      }
    }
    await this.db
      .update(integrations)
      .set(
        error
          ? { status: 'error', lastError: error }
          : { status: 'connected', lastSyncAt: new Date(), lastError: null },
      )
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
  }

  checkHeartbeats(now = new Date()): Promise<number> {
    return this.heartbeats.checkDeadlines(now);
  }

  async sourceForPreview(actor: ActorContext, id: string): Promise<{ kind: AlertSourceKind }> {
    const row = await this.find(actor, id);
    const kind = (row.config as unknown as SourceConfig).kind;
    if (kind === 'heartbeat')
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'not_previewable',
        'Heartbeats have no payload',
      );
    return { kind };
  }
}
