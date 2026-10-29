import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { incidents, outbox } from '../db/schema';
import { NotificationDispatcher } from '../../modules/notifications/application/notification-dispatcher.service';
import { TemporalService } from './temporal.service';

const MAX_ATTEMPTS = 20;

const backoffMs = (attempts: number) => Math.min(10 * 60_000, 1000 * 2 ** attempts);

@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly temporal: TemporalService,
    private readonly notifications: NotificationDispatcher,
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
      const done = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
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
        if (!row) return null;
        try {
          if (row.topic === 'incident.detected') {
            const p = row.payload as { incidentId: string; workspaceId: string };
            if (this.env.AUTO_INVESTIGATE) await this.temporal.startIncidentWorkflow(p);
          } else if (row.topic === 'notify') {
            await this.notifications.dispatch(row.payload as { incidentEventId: string });
          } else if (row.topic === 'deploy.recorded') {
            await this.signalWaitingForDeploy(
              row.workspaceId,
              row.payload as { serviceName: string; environment: string },
            );
          }
          await tx
            .update(outbox)
            .set({ publishedAt: sql`now()`, lastError: null })
            .where(eq(outbox.id, row.id));
          return true;
        } catch (err) {
          await tx
            .update(outbox)
            .set({
              attempts: row.attempts + 1,
              lastError: (err as Error).message.slice(0, 1000),
              nextAttemptAt: sql`now() + ${backoffMs(row.attempts + 1)} * interval '1 millisecond'`,
            })
            .where(eq(outbox.id, row.id));
          return false;
        }
      });
      if (done === null) break;
      if (done) published++;
    }
    return published;
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
