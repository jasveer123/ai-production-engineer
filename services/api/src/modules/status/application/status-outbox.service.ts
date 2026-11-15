import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  statusDeliveries,
  statusNotifications,
  statusPages,
  statusSubscribers,
} from '../../../core/db/schema';
import { Mailer } from '../../auth/infrastructure/mailer.service';
import { mailOutcome } from '../domain/projection';
import type { Db } from './status-read';

export interface StatusNotice {
  workspaceId: string;
  pageId: string;
  dedupKey: string;
  subject: string;
  body: string;
  reportId?: string;
  maintenanceId?: string;
  deliverAfter?: Date;
}

const MAX_ATTEMPTS = 3;
const CLAIM_MS = 5 * 60_000;
const backoffMs = (attempts: number) => 60_000 * 2 ** attempts;

@Injectable()
export class StatusOutbox {
  private readonly logger = new Logger(StatusOutbox.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly mailer: Mailer,
  ) {}

  async enqueue(db: Db, notice: StatusNotice): Promise<string | null> {
    const [row] = await db
      .insert(statusNotifications)
      // App clock, not the database default: fanOut compares against the caller's `now`.
      .values({ ...notice, deliverAfter: notice.deliverAfter ?? new Date() })
      .onConflictDoNothing({ target: [statusNotifications.pageId, statusNotifications.dedupKey] })
      .returning({ id: statusNotifications.id });
    return row?.id ?? null;
  }

  async fanOut(now = new Date(), limit = 20): Promise<number> {
    let done = 0;
    for (let i = 0; i < limit; i++) {
      const id = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select({ id: statusNotifications.id, pageId: statusNotifications.pageId })
          .from(statusNotifications)
          .where(
            and(
              isNull(statusNotifications.fannedOutAt),
              lte(statusNotifications.deliverAfter, now),
            ),
          )
          .orderBy(asc(statusNotifications.createdAt))
          .limit(1)
          .for('update', { skipLocked: true });
        if (!row) return null;
        const people = await tx
          .select({ id: statusSubscribers.id })
          .from(statusSubscribers)
          .where(
            and(
              eq(statusSubscribers.pageId, row.pageId),
              isNotNull(statusSubscribers.confirmedAt),
              isNull(statusSubscribers.unsubscribedAt),
            ),
          );
        if (people.length)
          await tx
            .insert(statusDeliveries)
            .values(
              people.map((p) => ({
                notificationId: row.id,
                subscriberId: p.id,
                nextAttemptAt: now,
              })),
            )
            .onConflictDoNothing();
        await tx
          .update(statusNotifications)
          .set({ fannedOutAt: now })
          .where(eq(statusNotifications.id, row.id));
        return row.id;
      });
      if (!id) break;
      done += 1;
    }
    return done;
  }

  private claim(limit: number, now: Date) {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({ id: statusDeliveries.id })
        .from(statusDeliveries)
        .where(and(eq(statusDeliveries.state, 'pending'), lte(statusDeliveries.nextAttemptAt, now)))
        .orderBy(asc(statusDeliveries.nextAttemptAt))
        .limit(limit)
        .for('update', { skipLocked: true });
      if (due.length === 0) return [];
      return tx
        .update(statusDeliveries)
        .set({
          attempts: sql`${statusDeliveries.attempts} + 1`,
          nextAttemptAt: new Date(now.getTime() + CLAIM_MS),
        })
        .where(
          inArray(
            statusDeliveries.id,
            due.map((d) => d.id),
          ),
        )
        .returning();
    });
  }

  async deliver(limit = 50, now = new Date()): Promise<number> {
    const claimed = await this.claim(limit, now);
    for (const delivery of claimed) {
      try {
        await this.deliverOne(delivery, now);
      } catch (err) {
        this.logger.error(err);
      }
    }
    return claimed.length;
  }

  private async deliverOne(
    delivery: typeof statusDeliveries.$inferSelect,
    now: Date,
  ): Promise<void> {
    const [row] = await this.db
      .select({
        subscriber: statusSubscribers,
        subject: statusNotifications.subject,
        body: statusNotifications.body,
        pageName: statusPages.name,
      })
      .from(statusDeliveries)
      .innerJoin(statusSubscribers, eq(statusSubscribers.id, statusDeliveries.subscriberId))
      .innerJoin(statusNotifications, eq(statusNotifications.id, statusDeliveries.notificationId))
      .innerJoin(statusPages, eq(statusPages.id, statusNotifications.pageId))
      .where(eq(statusDeliveries.id, delivery.id));
    if (!row) return;
    if (row.subscriber.unsubscribedAt || !row.subscriber.confirmedAt) {
      await this.mark(delivery.id, { state: 'skipped', lastError: 'Unsubscribed before sending' });
      return;
    }
    const unsubscribe = await this.unsubscribeToken(row.subscriber);
    const result: unknown = await this.mailer
      .send({
        to: row.subscriber.email,
        subject: row.subject,
        text: `${row.body}\n\nStop emails from ${row.pageName}: ${this.env.WEB_URL}/status-subscription/unsubscribe?token=${unsubscribe}`,
      })
      .then(
        (value: unknown) => value,
        (err: unknown) => ({ ok: false, error: (err as Error).message }),
      );
    const outcome = mailOutcome(result);
    if (outcome.ok) {
      await this.mark(delivery.id, { state: 'sent', sentAt: now, lastError: null });
      return;
    }
    const exhausted = delivery.attempts >= MAX_ATTEMPTS;
    await this.mark(delivery.id, {
      state: exhausted ? 'failed' : 'pending',
      lastError: outcome.error,
      nextAttemptAt: new Date(now.getTime() + backoffMs(delivery.attempts)),
    });
  }

  private async unsubscribeToken(subscriber: typeof statusSubscribers.$inferSelect) {
    if (subscriber.unsubscribeToken) return subscriber.unsubscribeToken;
    const token = randomBytes(24).toString('hex');
    await this.db
      .update(statusSubscribers)
      .set({ unsubscribeToken: token })
      .where(eq(statusSubscribers.id, subscriber.id));
    return token;
  }

  private async mark(id: string, patch: Partial<typeof statusDeliveries.$inferInsert>) {
    await this.db.update(statusDeliveries).set(patch).where(eq(statusDeliveries.id, id));
  }
}
