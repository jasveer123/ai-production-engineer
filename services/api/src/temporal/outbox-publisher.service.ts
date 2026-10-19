import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { outbox } from '../db/schema';
import { TemporalService } from './temporal.service';

const MAX_ATTEMPTS = 20;

/**
 * Publishes outbox rows written in the same transaction as their incident (transactional outbox).
 * At-least-once: a crash after starting the workflow but before marking the row published just
 * re-publishes, and the stable workflow id makes that a no-op.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly temporal: TemporalService,
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
          .where(and(isNull(outbox.publishedAt), lt(outbox.attempts, MAX_ATTEMPTS)))
          .orderBy(asc(outbox.id))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!row) return null;
        try {
          if (row.topic === 'incident.detected') {
            const p = row.payload as { incidentId: string; workspaceId: string };
            if (this.env.AUTO_INVESTIGATE) await this.temporal.startIncidentWorkflow(p);
          }
          await tx
            .update(outbox)
            .set({ publishedAt: sql`now()`, lastError: null })
            .where(eq(outbox.id, row.id));
          return true;
        } catch (err) {
          await tx
            .update(outbox)
            .set({ attempts: row.attempts + 1, lastError: (err as Error).message.slice(0, 1000) })
            .where(eq(outbox.id, row.id));
          return false;
        }
      });
      if (done === null) break;
      if (done) published++;
    }
    return published;
  }
}
