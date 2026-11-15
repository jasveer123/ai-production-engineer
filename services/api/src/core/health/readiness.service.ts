import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lte, min, sql } from 'drizzle-orm';
import type { HealthCheck, SystemStatus } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { inboundEvents, outbox, workerHeartbeats } from '../db/schema';
import { freshness, lag, overallStatus } from './overall';
import { hostPort, redisTarget, tcpProbe } from './tcp-probe';
import { WORKER_NAMES } from './worker-heartbeat';

const WORKER_MAX_AGE_MS = 2 * 60_000;
const QUEUE_MAX_LAG_MS = 5 * 60_000;

async function timed(name: string, run: () => Promise<unknown>): Promise<HealthCheck> {
  const started = Date.now();
  try {
    await run();
    return { name, status: 'ok', latencyMs: Date.now() - started, detail: null };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 200) : 'Unreachable';
    return { name, status: 'down', latencyMs: Date.now() - started, detail };
  }
}

@Injectable()
export class ReadinessService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  async check(now = new Date()): Promise<SystemStatus> {
    const database = await timed('database', () => this.db.execute(sql`select 1`));
    const [redis, temporal] = await Promise.all([
      timed('redis', () => tcpProbe(redisTarget(this.env.REDIS_URL))),
      timed('temporal', () => tcpProbe(hostPort(this.env.TEMPORAL_ADDRESS, 7233))),
    ]);
    const checks: HealthCheck[] = [database, redis, temporal, this.mail()];
    if (database.status === 'ok') checks.push(...(await this.queues(now)));
    return { status: overallStatus(checks), checkedAt: now.toISOString(), checks };
  }

  private mail(): HealthCheck {
    const transport = this.env.RESEND_API_KEY ? 'Resend' : this.env.SMTP_URL ? 'SMTP' : null;
    return transport
      ? { name: 'mail', status: 'ok', latencyMs: null, detail: `${transport} configured` }
      : {
          name: 'mail',
          status: 'degraded',
          latencyMs: null,
          detail: 'No mail transport configured',
        };
  }

  private async queues(now: Date): Promise<HealthCheck[]> {
    const beats = await this.db
      .select({ name: workerHeartbeats.name, beatAt: workerHeartbeats.beatAt })
      .from(workerHeartbeats);
    const [out] = await this.db
      .select({ oldest: min(outbox.createdAt) })
      .from(outbox)
      .where(and(isNull(outbox.publishedAt), lte(outbox.nextAttemptAt, now)));
    const [inbound] = await this.db
      .select({ oldest: min(inboundEvents.receivedAt) })
      .from(inboundEvents)
      .where(and(eq(inboundEvents.status, 'pending'), lte(inboundEvents.nextAttemptAt, now)));
    const at = (name: string) => beats.find((b) => b.name === name)?.beatAt ?? null;
    return [
      ...WORKER_NAMES.map((n) => freshness(`worker:${n}`, at(n), now, WORKER_MAX_AGE_MS)),
      lag('outbox', out?.oldest ?? null, now, QUEUE_MAX_LAG_MS),
      lag('inbound_queue', inbound?.oldest ?? null, now, QUEUE_MAX_LAG_MS),
    ];
  }
}
