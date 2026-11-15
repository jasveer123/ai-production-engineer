import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, ne, sql } from 'drizzle-orm';
import type { HeartbeatPingView, HeartbeatStatus } from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { heartbeatPings, integrations } from '../../../core/db/schema';
import { recordWorkerBeat } from '../../../core/health/worker-heartbeat';
import {
  applyDeadline,
  applyPing,
  dueAt,
  evaluateHeartbeat,
  type HeartbeatConfig,
  type HeartbeatTransition,
  type PingInput,
} from '../domain/heartbeat';
import { bufferAlertEvent } from './alert-buffer';

type Row = typeof integrations.$inferSelect;

export const ALERT_SOURCE_PROVIDER = 'alert_source';
const PING_RETENTION_DAYS = 30;
const MAX_BODY = 2000;

export interface HeartbeatSourceConfig extends HeartbeatConfig {
  kind: 'heartbeat';
  metadata?: Record<string, string>;
  escalationPolicyId?: string | null;
}

export interface PingResult {
  state: HeartbeatStatus['state'];
  outcome: HeartbeatTransition['outcome'];
  durationMs: number | null;
}

export function heartbeatStatus(cfg: HeartbeatSourceConfig, now = new Date()): HeartbeatStatus {
  const due = dueAt(cfg);
  return {
    intervalSeconds: cfg.intervalSeconds ?? 300,
    graceSeconds: cfg.graceSeconds ?? 60,
    state: evaluateHeartbeat(
      { ...cfg, intervalSeconds: cfg.intervalSeconds ?? 300, graceSeconds: cfg.graceSeconds ?? 60 },
      now,
    ),
    paused: Boolean(cfg.paused),
    lastPingAt: cfg.lastPingAt ?? null,
    dueAt: due?.toISOString() ?? null,
    running: cfg.running ?? null,
    metadata: cfg.metadata ?? {},
  };
}

@Injectable()
export class HeartbeatsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async locked(tx: Tx, id: string): Promise<Row | undefined> {
    const [row] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.provider, ALERT_SOURCE_PROVIDER)))
      .for('update');
    return row;
  }

  private async commit(tx: Tx, row: Row, t: HeartbeatTransition, at: Date): Promise<void> {
    await tx
      .update(integrations)
      .set({
        config: t.config as unknown as Record<string, unknown>,
        ...(t.outcome === 'unchanged' ? {} : { status: 'connected' as const, lastSyncAt: at }),
      })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
    if (!t.emit) return;
    await bufferAlertEvent(
      tx,
      { id: row.id, workspaceId: row.workspaceId, kind: 'heartbeat' },
      {
        externalEventId: `heartbeat-${t.emit.status}-${at.toISOString()}`,
        payload: {
          status: t.emit.status,
          name: row.name,
          cause: t.emit.status === 'firing' ? t.emit.cause : null,
          lastPingAt: t.config.lastPingAt ?? null,
          occurredAt: at.toISOString(),
        },
      },
    );
  }

  async signal(sourceId: string, input: PingInput): Promise<PingResult> {
    return this.db.transaction(async (tx) => {
      const row = await this.locked(tx, sourceId);
      if (!row) throw new Error('Heartbeat disappeared while handling a ping');
      const cfg = row.config as unknown as HeartbeatSourceConfig;
      const t = applyPing(cfg, input);
      await this.commit(tx, row, t, input.at);
      await tx.insert(heartbeatPings).values({
        workspaceId: row.workspaceId,
        sourceId: row.id,
        signal: input.signal,
        outcome: t.outcome,
        executionId: input.executionId,
        durationMs: t.durationMs,
        body: input.cause ? input.cause.slice(0, MAX_BODY) : null,
        receivedAt: input.at,
      });
      const next = { ...cfg, ...t.config } as HeartbeatSourceConfig;
      return {
        state: heartbeatStatus(next, input.at).state,
        outcome: t.outcome,
        durationMs: t.durationMs,
      };
    });
  }

  async checkDeadlines(now = new Date()): Promise<number> {
    const candidates = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          sql`${integrations.config}->>'kind' = 'heartbeat'`,
          sql`coalesce(${integrations.config}->>'state', 'pending') <> 'down'`,
          sql`coalesce((${integrations.config}->>'paused')::boolean, false) = false`,
          sql`coalesce(${integrations.config}->>'windowStartAt', ${integrations.config}->>'lastPingAt')::timestamptz
              + make_interval(secs => ((${integrations.config}->>'intervalSeconds')::int
                                       + coalesce((${integrations.config}->>'graceSeconds')::int, 0)))
              <= ${now.toISOString()}::timestamptz`,
        ),
      );
    let opened = 0;
    for (const { id } of candidates) {
      opened += await this.db.transaction(async (tx) => {
        const row = await this.locked(tx, id);
        if (!row || row.status === 'disconnected') return 0;
        const t = applyDeadline(row.config as unknown as HeartbeatSourceConfig, now);
        if (!t.emit) return 0;
        await this.commit(tx, row, t, now);
        return 1;
      });
    }
    await this.db
      .delete(heartbeatPings)
      .where(
        lt(heartbeatPings.receivedAt, new Date(now.getTime() - PING_RETENTION_DAYS * 86_400_000)),
      );
    await recordWorkerBeat(this.db, 'heartbeat-checker');
    return opened;
  }

  async pings(workspaceId: string, sourceId: string, limit = 100): Promise<HeartbeatPingView[]> {
    const rows = await this.db
      .select()
      .from(heartbeatPings)
      .where(
        and(eq(heartbeatPings.workspaceId, workspaceId), eq(heartbeatPings.sourceId, sourceId)),
      )
      .orderBy(desc(heartbeatPings.receivedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      signal: r.signal as HeartbeatPingView['signal'],
      outcome: r.outcome,
      executionId: r.executionId,
      durationMs: r.durationMs,
      body: r.body,
      receivedAt: r.receivedAt.toISOString(),
    }));
  }
}
