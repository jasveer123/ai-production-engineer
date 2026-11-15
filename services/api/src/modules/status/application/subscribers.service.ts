import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type {
  SubscriberDeliveryState,
  NotificationView,
  SubscriberState,
  SubscriberView,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
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

type PageRow = typeof statusPages.$inferSelect;
type SubscriberRow = typeof statusSubscribers.$inferSelect;

const CONFIRM_TTL_MS = 24 * 3600 * 1000;
const newToken = () => randomBytes(24).toString('hex');
const invalidLink = () =>
  new ApiException(HttpStatus.NOT_FOUND, 'invalid_token', 'This link is not valid');

const stateOf = (row: SubscriberRow): SubscriberState =>
  row.unsubscribedAt ? 'unsubscribed' : row.confirmedAt ? 'confirmed' : 'pending';

const csvCell = (value: string) => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

@Injectable()
export class SubscribersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly mailer: Mailer,
  ) {}

  async subscribe(slug: string, email: string): Promise<void> {
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.slug, slug));
    if (!page) throw notFound('Status page');
    await this.enroll(page, email);
  }

  async enroll(page: PageRow, email: string, now = new Date()): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(statusSubscribers)
      .where(and(eq(statusSubscribers.pageId, page.id), eq(statusSubscribers.email, email)));
    if (existing && stateOf(existing) === 'confirmed') return;
    const token = newToken();
    const pending = {
      token,
      confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
      confirmedAt: null,
      unsubscribedAt: null,
    };
    if (existing)
      await this.db
        .update(statusSubscribers)
        .set(pending)
        .where(eq(statusSubscribers.id, existing.id));
    else
      await this.db
        .insert(statusSubscribers)
        .values({ pageId: page.id, email, ...pending })
        .onConflictDoUpdate({
          target: [statusSubscribers.pageId, statusSubscribers.email],
          set: pending,
          where: isNull(statusSubscribers.confirmedAt),
        });
    await this.mailer.send({
      to: email,
      subject: `Confirm updates from ${page.name}`,
      text: `Confirm to get an email whenever ${page.name} reports a problem:\n${this.env.WEB_URL}/status-subscription/confirm?token=${token}\n\nThis link expires in 24 hours. If this was not you, ignore this email.`,
    });
  }

  async confirm(token: string, now = new Date()): Promise<{ page: string }> {
    if (!token) throw invalidLink();
    const [row] = await this.db
      .update(statusSubscribers)
      .set({
        confirmedAt: now,
        unsubscribedAt: null,
        token: newToken(),
        unsubscribeToken: sql`coalesce(${statusSubscribers.unsubscribeToken}, ${newToken()})`,
      })
      .where(
        and(
          eq(statusSubscribers.token, token),
          isNull(statusSubscribers.confirmedAt),
          gt(statusSubscribers.confirmExpiresAt, now),
        ),
      )
      .returning();
    if (!row) throw invalidLink();
    return { page: await this.pageName(row.pageId) };
  }

  async unsubscribe(token: string, now = new Date()): Promise<{ page: string }> {
    if (!token) throw invalidLink();
    const [row] = await this.db
      .update(statusSubscribers)
      .set({ unsubscribedAt: sql`coalesce(${statusSubscribers.unsubscribedAt}, ${now})` })
      .where(
        or(
          eq(statusSubscribers.unsubscribeToken, token),
          and(
            eq(statusSubscribers.token, token),
            isNull(statusSubscribers.unsubscribeToken),
            isNotNull(statusSubscribers.confirmedAt),
          ),
        ),
      )
      .returning();
    if (!row) throw invalidLink();
    return { page: await this.pageName(row.pageId) };
  }

  private async pageName(pageId: string): Promise<string> {
    const [page] = await this.db
      .select({ name: statusPages.name })
      .from(statusPages)
      .where(eq(statusPages.id, pageId));
    return page?.name ?? '';
  }

  async count(pageId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(statusSubscribers)
      .where(
        and(
          eq(statusSubscribers.pageId, pageId),
          isNotNull(statusSubscribers.confirmedAt),
          isNull(statusSubscribers.unsubscribedAt),
        ),
      );
    return row?.n ?? 0;
  }

  async list(pageId: string): Promise<SubscriberView[]> {
    const rows = await this.db
      .select()
      .from(statusSubscribers)
      .where(eq(statusSubscribers.pageId, pageId))
      .orderBy(desc(statusSubscribers.createdAt))
      .limit(5000);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      state: stateOf(r),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async remove(pageId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(statusSubscribers)
      .where(and(eq(statusSubscribers.id, id), eq(statusSubscribers.pageId, pageId)))
      .returning({ id: statusSubscribers.id });
    if (!row) throw notFound('Subscriber');
  }

  async csv(pageId: string): Promise<string> {
    const rows = await this.list(pageId);
    const lines = rows.map((r) => [r.email, r.state, r.createdAt].map(csvCell).join(','));
    return ['email,state,subscribed_at', ...lines].join('\n') + '\n';
  }

  async notifications(pageId: string): Promise<NotificationView[]> {
    const rows = await this.db
      .select()
      .from(statusNotifications)
      .where(eq(statusNotifications.pageId, pageId))
      .orderBy(desc(statusNotifications.createdAt))
      .limit(30);
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const counts = await this.db
      .select({
        id: statusDeliveries.notificationId,
        state: statusDeliveries.state,
        n: sql<number>`count(*)::int`,
      })
      .from(statusDeliveries)
      .where(inArray(statusDeliveries.notificationId, ids))
      .groupBy(statusDeliveries.notificationId, statusDeliveries.state);
    const failures = await this.db
      .select({
        id: statusDeliveries.notificationId,
        email: statusSubscribers.email,
        error: statusDeliveries.lastError,
      })
      .from(statusDeliveries)
      .innerJoin(statusSubscribers, eq(statusSubscribers.id, statusDeliveries.subscriberId))
      .where(
        and(inArray(statusDeliveries.notificationId, ids), eq(statusDeliveries.state, 'failed')),
      )
      .limit(200);
    return rows.map((r) => {
      const tally: Record<SubscriberDeliveryState, number> = {
        pending: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
      for (const c of counts.filter((c) => c.id === r.id))
        tally[c.state as SubscriberDeliveryState] = c.n;
      return {
        id: r.id,
        subject: r.subject,
        createdAt: r.createdAt.toISOString(),
        deliverAfter: r.deliverAfter.toISOString(),
        fannedOut: Boolean(r.fannedOutAt),
        counts: tally,
        failures: failures
          .filter((f) => f.id === r.id)
          .map((f) => ({ email: f.email, error: f.error })),
      };
    });
  }
}
