import { randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type {
  AlertSource,
  AlertSourceKind,
  AlertSourceWithToken,
  CreateAlertSourceInput,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { inboundEvents, integrations } from '../db/schema';
import { SecretStore } from '../secrets/secret-store.service';
import { ALERT_SOURCE_PREFIX } from './alert-processor';

export const ALERT_SOURCE_PROVIDER = 'alert_source';
type Row = typeof integrations.$inferSelect;

export interface SourceConfig {
  kind: AlertSourceKind;
  intervalSeconds?: number;
  graceSeconds?: number;
  state?: 'pending' | 'up' | 'down';
  lastPingAt?: string | null;
}

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
  ) {}

  toDto(r: Row): AlertSource {
    const cfg = r.config as unknown as SourceConfig;
    const heartbeat = cfg.kind === 'heartbeat';
    return {
      id: r.id,
      kind: cfg.kind,
      name: r.name,
      status: r.status,
      url: `${this.env.PUBLIC_API_URL}/ingest/${heartbeat ? 'heartbeats' : 'alerts'}/${r.id}`,
      lastReceivedAt: r.lastSyncAt?.toISOString() ?? null,
      lastError: r.lastError,
      heartbeat: heartbeat
        ? {
            intervalSeconds: cfg.intervalSeconds ?? 300,
            graceSeconds: cfg.graceSeconds ?? 60,
            state: cfg.state ?? 'pending',
            lastPingAt: cfg.lastPingAt ?? null,
          }
        : null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async find(actor: ActorContext, id: string): Promise<Row> {
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
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'alert_source',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
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

  async create(actor: ActorContext, input: CreateAlertSourceInput): Promise<AlertSourceWithToken> {
    const token = newToken();
    const config: SourceConfig =
      input.kind === 'heartbeat'
        ? {
            kind: 'heartbeat',
            intervalSeconds: input.intervalSeconds,
            graceSeconds: input.graceSeconds ?? 60,
            state: 'pending',
            lastPingAt: null,
          }
        : { kind: input.kind };
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
        .where(eq(integrations.id, id))
        .returning();
      return r!;
    });
    await this.record(actor, 'alert_source.token_rotated', id);
    return { ...this.toDto(updated), token };
  }

  /** Stops accepting alerts: the token is deleted. Existing alerts and incidents stay. */
  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db.transaction(async (tx) => {
      if (row.secretReference)
        await this.secrets.delete(actor.workspaceId, row.secretReference, tx);
      await tx
        .update(integrations)
        .set({ status: 'disconnected', secretReference: null })
        .where(eq(integrations.id, id));
    });
    await this.record(actor, 'alert_source.disconnected', id);
  }

  /**
   * Authenticates an incoming request for a source. Unknown sources and bad tokens get the same
   * answer, so ids cannot be probed. Returns the source on success.
   */
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

  /** A source row by id, for routing webhooks that identify the workspace themselves. */
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

  /** Buffers an alert request durably; processing happens asynchronously (Phase 3 pipeline). */
  async buffer(
    row: Row,
    externalEventId: string,
    payload: Record<string, unknown>,
    /** False for alerts the platform writes itself (a missed heartbeat received nothing). */
    received = true,
  ) {
    const kind = (row.config as unknown as SourceConfig).kind;
    const inserted = await this.db
      .insert(inboundEvents)
      .values({
        workspaceId: row.workspaceId,
        integrationId: row.id,
        source: `${ALERT_SOURCE_PREFIX}${kind}`,
        externalEventId,
        payload,
      })
      .onConflictDoNothing()
      .returning({ id: inboundEvents.id });
    if (received) {
      await this.db
        .update(integrations)
        .set({ status: 'connected', lastSyncAt: new Date(), lastError: null })
        .where(eq(integrations.id, row.id));
    }
    return inserted.length === 0;
  }

  /**
   * Confirms an SNS subscription by visiting its SubscribeURL. The request is already
   * authenticated by the source token; the URL must be an AWS SNS endpoint (no SSRF).
   */
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
      .where(eq(integrations.id, row.id));
  }

  /** A heartbeat ping. If the heartbeat was down, it resolves the missed-heartbeat alert. */
  async ping(row: Row): Promise<'up' | 'recovered'> {
    const now = new Date();
    // Conditional update: only one concurrent ping sees the down -> up transition.
    const recovered = await this.db
      .update(integrations)
      .set({
        status: 'connected',
        lastSyncAt: now,
        config: sql`${integrations.config} || jsonb_build_object('state', 'up', 'lastPingAt', ${now.toISOString()}::text)`,
      })
      .where(and(eq(integrations.id, row.id), sql`${integrations.config}->>'state' = 'down'`))
      .returning({ id: integrations.id });
    if (recovered.length) {
      await this.buffer(row, `heartbeat-resumed-${now.toISOString()}`, {
        status: 'resolved',
        name: row.name,
        lastPingAt: now.toISOString(),
      });
      return 'recovered';
    }
    await this.db
      .update(integrations)
      .set({
        status: 'connected',
        lastSyncAt: now,
        config: sql`${integrations.config} || jsonb_build_object('state', 'up', 'lastPingAt', ${now.toISOString()}::text)`,
      })
      .where(eq(integrations.id, row.id));
    return 'up';
  }

  /**
   * Marks overdue heartbeats down and raises an alert for each. Runs on an interval in the API
   * process; the conditional update makes it safe to run on several replicas.
   */
  async checkHeartbeats(now = new Date()): Promise<number> {
    const overdue = await this.db
      .update(integrations)
      .set({ config: sql`${integrations.config} || '{"state":"down"}'::jsonb` })
      .where(
        and(
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'kind' = 'heartbeat'`,
          sql`coalesce(${integrations.config}->>'state', 'pending') <> 'down'`,
          sql`coalesce((${integrations.config}->>'lastPingAt')::timestamptz, ${integrations.createdAt})
              + make_interval(secs => ((${integrations.config}->>'intervalSeconds')::int
                                       + coalesce((${integrations.config}->>'graceSeconds')::int, 0)))
              < ${now.toISOString()}::timestamptz`,
        ),
      )
      .returning();
    for (const row of overdue) {
      const cfg = row.config as unknown as SourceConfig;
      await this.buffer(
        row,
        `heartbeat-missed-${now.toISOString()}`,
        {
          status: 'firing',
          name: row.name,
          lastPingAt: cfg.lastPingAt ?? null,
        },
        false,
      );
    }
    return overdue.length;
  }

  /** For the admin UI: throws if the source is a heartbeat (it has no payloads to preview). */
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
