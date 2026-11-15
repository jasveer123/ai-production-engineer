import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, or } from 'drizzle-orm';
import type { CreateFunnelInput, FunnelResult, FunnelUnit, FunnelView } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { rumApplications, rumEvents, rumFunnels, rumSessions } from '../../../core/db/schema';
import { reachedPerStep } from '../domain/funnel';

const FUNNEL_EVENT_CAP = 200_000;

const funnelView = (r: typeof rumFunnels.$inferSelect): FunnelView => ({
  id: r.id,
  appId: r.appId,
  name: r.name,
  steps: r.steps as FunnelView['steps'],
  unit: r.unit as FunnelUnit,
  windowMinutes: r.windowMinutes,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class RumFunnelsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(actor: ActorContext): Promise<FunnelView[]> {
    const rows = await this.db
      .select()
      .from(rumFunnels)
      .where(eq(rumFunnels.workspaceId, actor.workspaceId))
      .orderBy(asc(rumFunnels.createdAt));
    return rows.map(funnelView);
  }

  async create(actor: ActorContext, input: CreateFunnelInput): Promise<FunnelView> {
    const [app] = await this.db
      .select({ id: rumApplications.id })
      .from(rumApplications)
      .where(
        and(
          eq(rumApplications.id, input.appId),
          eq(rumApplications.workspaceId, actor.workspaceId),
        ),
      );
    if (!app) throw notFound('Application');
    const [row] = await this.db
      .insert(rumFunnels)
      .values({
        workspaceId: actor.workspaceId,
        appId: input.appId,
        name: input.name,
        steps: input.steps,
        unit: input.unit,
        windowMinutes: input.windowMinutes,
      })
      .returning();
    return funnelView(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const removed = await this.db
      .delete(rumFunnels)
      .where(and(eq(rumFunnels.id, id), eq(rumFunnels.workspaceId, actor.workspaceId)))
      .returning({ id: rumFunnels.id });
    if (removed.length === 0) throw notFound('Funnel');
  }

  async result(actor: ActorContext, id: string, minutes: number): Promise<FunnelResult> {
    const [row] = await this.db
      .select()
      .from(rumFunnels)
      .where(and(eq(rumFunnels.id, id), eq(rumFunnels.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Funnel');
    const funnel = funnelView(row);
    const names = funnel.steps.filter((s) => s.kind === 'event').map((s) => s.match);
    const events = await this.db
      .select({
        sessionId: rumEvents.sessionId,
        userId: rumSessions.userId,
        seq: rumEvents.id,
        ts: rumEvents.ts,
        type: rumEvents.type,
        name: rumEvents.name,
        url: rumEvents.url,
      })
      .from(rumEvents)
      .innerJoin(rumSessions, eq(rumSessions.id, rumEvents.sessionId))
      .where(
        and(
          eq(rumEvents.workspaceId, actor.workspaceId),
          eq(rumEvents.appId, row.appId),
          gte(rumEvents.ts, new Date(Date.now() - minutes * 60_000)),
          or(
            eq(rumEvents.type, 'pageview'),
            names.length ? inArray(rumEvents.name, names) : undefined,
          ),
        ),
      )
      .orderBy(asc(rumEvents.ts), asc(rumEvents.id))
      .limit(FUNNEL_EVENT_CAP);
    const reached = reachedPerStep(
      funnel.steps,
      events.map((e) => ({ ...e, ts: e.ts.getTime() })),
      { unit: funnel.unit, windowMs: funnel.windowMinutes ? funnel.windowMinutes * 60_000 : null },
    );
    const first = reached[0] ?? 0;
    return {
      funnel,
      capped: events.length >= FUNNEL_EVENT_CAP,
      steps: funnel.steps.map((s, i) => ({
        label: s.label || `${s.kind === 'pageview' ? 'Visit' : 'Event'} ${s.match}`,
        sessions: reached[i]!,
        conversion: first ? Math.round(((reached[i] ?? 0) / first) * 1000) / 10 : 0,
        dropOff: i === 0 ? 0 : (reached[i - 1] ?? 0) - (reached[i] ?? 0),
      })),
    };
  }
}
