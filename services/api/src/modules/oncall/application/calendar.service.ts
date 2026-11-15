import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { CalendarLink } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { oncallSchedules } from '../../../core/db/schema';
import { toICalendar } from '../domain/ical';
import { OncallService } from './oncall.service';

const DAY_MS = 86_400_000;
const PAST_DAYS = 7;
const FUTURE_DAYS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class CalendarService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly oncall: OncallService,
  ) {}

  private async setHash(actor: ActorContext, id: string, hash: string | null) {
    await this.oncall.find(actor.workspaceId, id);
    await this.db
      .update(oncallSchedules)
      .set({ calendarTokenHash: hash })
      .where(and(eq(oncallSchedules.id, id), eq(oncallSchedules.workspaceId, actor.workspaceId)));
  }

  async enable(actor: ActorContext, id: string): Promise<CalendarLink> {
    const token = randomBytes(24).toString('hex');
    await this.setHash(actor, id, hashOf(token));
    await this.oncall.record(actor, 'oncall.calendar_link_created', id);
    return { url: `${this.env.PUBLIC_API_URL}/public/oncall/${id}/calendar.ics?token=${token}` };
  }

  async revoke(actor: ActorContext, id: string): Promise<void> {
    await this.setHash(actor, id, null);
    await this.oncall.record(actor, 'oncall.calendar_link_revoked', id);
  }

  async feed(scheduleId: string, token: string | undefined): Promise<string> {
    if (!token || !UUID.test(scheduleId)) throw notFound('Calendar');
    const [row] = await this.db
      .select()
      .from(oncallSchedules)
      .where(
        and(
          eq(oncallSchedules.id, scheduleId),
          eq(oncallSchedules.calendarTokenHash, hashOf(token)),
        ),
      );
    if (!row) throw notFound('Calendar');
    const now = Date.now();
    const { intervals } = await this.oncall.evaluate(
      row.workspaceId,
      row,
      new Date(now - PAST_DAYS * DAY_MS),
      new Date(now + FUTURE_DAYS * DAY_MS),
    );
    return toICalendar({ id: row.id, name: row.name }, intervals, new Date(now));
  }
}
