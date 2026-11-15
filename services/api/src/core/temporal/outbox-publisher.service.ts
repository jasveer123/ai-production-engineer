import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { and, asc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { incidents, outbox } from '../db/schema';
import { NotificationDispatcher } from '../../modules/notifications/application/notification-dispatcher.service';
import { EscalationEngine } from '../../modules/escalation/application/escalation-engine.service';
import { TemporalService } from './temporal.service';

const MAX_ATTEMPTS = 20;
/** A claimed row becomes due again when its lease runs out, so a crashed worker's rows are retried. */
const LEASE_MS = 2 * 60_000;

type OutboxRow = typeof outbox.$inferSelect;

const backoffMs = (attempts: number) => Math.min(10 * 60_000, 1000 * 2 ** attempts);

@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly owner = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly temporal: TemporalService,
    private readonly notifications: NotificationDispatcher,
    private readonly escalation: EscalationEngine,
  ) {}

  onApplicationBootstrap() {
    if (process.env.OUTBOX_PUBLISHER_ENABLED !== 'true') return;
    this.timer = setInterval(() => void this.tick(), 1000);
    this.logger.log('Outbox publisher started');
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.publishBatch();
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.busy = false;
    }
  }

  async publishBatch(limit = 20): Promise<number> {
    let published = 0;
    for (let i = 0; i < limit; i++) {
      const row = await this.claim();
      if (!row) break;
      if (await this.handle(row)) published++;
    }
    return published;
  }

  /** Leases one due row in a short transaction; the network work happens after it commits. */
  private claim(): Promise<OutboxRow | undefined> {
    return this.db.transaction(async (tx) => {
      const [due] = await tx
        .select({ id: outbox.id })
        .from(outbox)
        .where(
          and(
            isNull(outbox.publishedAt),
            lt(outbox.attempts, MAX_ATTEMPTS),
            lte(outbox.nextAttemptAt, sql`now()`),
          ),
        )
        .orderBy(asc(outbox.id))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!due) return undefined;
      const [row] = await tx
        .update(outbox)
        .set({
          leaseOwner: this.owner,
          nextAttemptAt: sql`now() + ${LEASE_MS} * interval '1 millisecond'`,
        })
        .where(eq(outbox.id, due.id))
        .returning();
      return row;
    });
  }

  private async handle(row: OutboxRow): Promise<boolean> {
    const mine = and(eq(outbox.id, row.id), eq(outbox.leaseOwner, this.owner));
    try {
      await this.perform(row);
      await this.db
        .update(outbox)
        .set({ publishedAt: sql`now()`, lastError: null, leaseOwner: null })
        .where(mine);
      return true;
    } catch (err) {
      await this.db
        .update(outbox)
        .set({
          attempts: row.attempts + 1,
          lastError: (err as Error).message.slice(0, 1000),
          leaseOwner: null,
          nextAttemptAt: sql`now() + ${backoffMs(row.attempts + 1)} * interval '1 millisecond'`,
        })
        .where(mine);
      return false;
    }
  }

  private async perform(row: OutboxRow): Promise<void> {
    if (row.topic === 'incident.detected') {
      const p = row.payload as { incidentId: string; workspaceId: string };
      await this.escalation.startForIncident(p.incidentId);
      if (this.env.AUTO_INVESTIGATE) await this.temporal.startIncidentWorkflow(p);
    } else if (row.topic === 'notify') {
      await this.notifications.dispatch(row.payload as { incidentEventId: string });
    } else if (row.topic === 'deploy.recorded') {
      await this.signalWaitingForDeploy(
        row.workspaceId,
        row.payload as { serviceName: string; environment: string },
      );
    }
  }

  private async signalWaitingForDeploy(
    workspaceId: string,
    p: { serviceName: string; environment: string },
  ) {
    const waiting = await this.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.workspaceId, workspaceId),
          eq(incidents.serviceName, p.serviceName),
          eq(incidents.environment, p.environment),
          inArray(incidents.status, ['monitoring', 'verification_inconclusive']),
        ),
      );
    for (const { id } of waiting) await this.temporal.deployRecorded(id);
  }
}
