import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { ApiException, notFound } from '../../../core/common/errors';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { statusPages, statusSubscribers } from '../../../core/db/schema';
import { Mailer } from '../../auth/infrastructure/mailer.service';

const newToken = () => randomBytes(24).toString('hex');

@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly mailer: Mailer,
  ) {}

  async subscribe(slug: string, email: string): Promise<void> {
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.slug, slug));
    if (!page) throw notFound('Status page');
    const [existing] = await this.db
      .select()
      .from(statusSubscribers)
      .where(and(eq(statusSubscribers.pageId, page.id), eq(statusSubscribers.email, email)));
    if (existing?.confirmedAt) return;
    const token = existing?.token ?? newToken();
    if (!existing)
      await this.db.insert(statusSubscribers).values({ pageId: page.id, email, token });
    await this.mailer.send({
      to: email,
      subject: `Confirm updates from ${page.name}`,
      text: `Confirm to get an email whenever ${page.name} reports a problem:\n${this.env.WEB_URL}/status-subscription/confirm?token=${token}\n\nIf this was not you, ignore this email.`,
    });
  }

  async confirm(token: string): Promise<{ page: string }> {
    const [row] = await this.db
      .update(statusSubscribers)
      .set({ confirmedAt: new Date() })
      .where(eq(statusSubscribers.token, token))
      .returning();
    if (!row)
      throw new ApiException(HttpStatus.NOT_FOUND, 'invalid_token', 'This link is not valid');
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.id, row.pageId));
    return { page: page?.name ?? '' };
  }

  async unsubscribe(token: string): Promise<{ page: string }> {
    const [row] = await this.db
      .delete(statusSubscribers)
      .where(eq(statusSubscribers.token, token))
      .returning();
    if (!row)
      throw new ApiException(HttpStatus.NOT_FOUND, 'invalid_token', 'This link is not valid');
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.id, row.pageId));
    return { page: page?.name ?? '' };
  }

  async count(pageId: string): Promise<number> {
    const rows = await this.db
      .select({ id: statusSubscribers.id })
      .from(statusSubscribers)
      .where(and(eq(statusSubscribers.pageId, pageId), isNotNull(statusSubscribers.confirmedAt)));
    return rows.length;
  }

  async notify(
    pageId: string,
    update: { title: string; body: string; state: string },
  ): Promise<number> {
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.id, pageId));
    if (!page) return 0;
    const people = await this.db
      .select()
      .from(statusSubscribers)
      .where(and(eq(statusSubscribers.pageId, pageId), isNotNull(statusSubscribers.confirmedAt)));
    for (const person of people)
      await this.mailer
        .send({
          to: person.email,
          subject: `[${page.name}] ${update.state}: ${update.title}`,
          text: `${update.title}\n${update.body}\n\nStatus: ${update.state}\n${this.env.WEB_URL}/status/${page.slug}\n\nStop these emails: ${this.env.WEB_URL}/status-subscription/unsubscribe?token=${person.token}`,
        })
        .catch((err: unknown) => this.logger.error(err));
    return people.length;
  }
}
