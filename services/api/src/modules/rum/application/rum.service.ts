import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type {
  CreateFunnelInput,
  CreateRumAppInput,
  FunnelResult,
  FunnelView,
  RumAppView,
  RumEventSummary,
  RumEventType,
  RumEventView,
  RumOverview,
  RumReplay,
  RumSessionDetail,
  RumSessionView,
  RumUserView,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  rumApplications,
  rumEvents,
  rumFunnels,
  rumReplay,
  rumSessions,
} from '../../../core/db/schema';
import { reachedPerStep } from '../domain/funnel';

type SessionRow = typeof rumSessions.$inferSelect;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);
const TREND_BUCKETS = 24;
const FUNNEL_EVENT_CAP = 200_000;

const sessionView = (r: SessionRow, appName: string): RumSessionView => ({
  id: r.id,
  appId: r.appId,
  appName,
  userId: r.userId,
  userName: r.userName,
  userEmail: r.userEmail,
  startedAt: r.startedAt.toISOString(),
  lastSeenAt: r.lastSeenAt.toISOString(),
  durationSeconds: Math.max(0, Math.round((r.lastSeenAt.getTime() - r.startedAt.getTime()) / 1000)),
  pageViews: r.pageViews,
  errors: r.errors,
  clicks: r.clicks,
  entryUrl: r.entryUrl,
  browser: r.browser,
  os: r.os,
  device: r.device,
  hasReplay: r.hasReplay,
});

@Injectable()
export class RumService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private since(minutes: number) {
    return new Date(Date.now() - minutes * 60_000);
  }

  async listApps(actor: ActorContext): Promise<RumAppView[]> {
    const apps = await this.db
      .select()
      .from(rumApplications)
      .where(eq(rumApplications.workspaceId, actor.workspaceId))
      .orderBy(asc(rumApplications.createdAt));
    const counts = await this.db
      .select({ appId: rumSessions.appId, n: sql<number>`count(*)::int` })
      .from(rumSessions)
      .where(
        and(
          eq(rumSessions.workspaceId, actor.workspaceId),
          gte(rumSessions.lastSeenAt, this.since(1440)),
        ),
      )
      .groupBy(rumSessions.appId);
    const byApp = new Map(counts.map((c) => [c.appId, c.n]));
    return apps.map((a) => ({
      id: a.id,
      name: a.name,
      appKey: a.appKey,
      sessions24h: byApp.get(a.id) ?? 0,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async createApp(actor: ActorContext, input: CreateRumAppInput): Promise<RumAppView> {
    const [row] = await this.db
      .insert(rumApplications)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        appKey: `rum_${randomBytes(12).toString('hex')}`,
      })
      .returning();
    return {
      id: row!.id,
      name: row!.name,
      appKey: row!.appKey,
      sessions24h: 0,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  async removeApp(actor: ActorContext, id: string): Promise<void> {
    const removed = await this.db
      .delete(rumApplications)
      .where(and(eq(rumApplications.id, id), eq(rumApplications.workspaceId, actor.workspaceId)))
      .returning({ id: rumApplications.id });
    if (removed.length === 0) throw notFound('Application');
  }

  async sessions(
    actor: ActorContext,
    q: {
      appId?: string;
      userId?: string;
      hasErrors?: 'true' | 'false';
      q?: string;
      minutes: number;
      limit: number;
    },
  ): Promise<RumSessionView[]> {
    const text = q.q ? `%${escapeLike(q.q)}%` : null;
    const rows = await this.db
      .select({ s: rumSessions, appName: rumApplications.name })
      .from(rumSessions)
      .innerJoin(rumApplications, eq(rumApplications.id, rumSessions.appId))
      .where(
        and(
          eq(rumSessions.workspaceId, actor.workspaceId),
          gte(rumSessions.lastSeenAt, this.since(q.minutes)),
          q.appId ? eq(rumSessions.appId, q.appId) : undefined,
          q.userId ? eq(rumSessions.userId, q.userId) : undefined,
          q.hasErrors === 'true' ? sql`${rumSessions.errors} > 0` : undefined,
          q.hasErrors === 'false' ? sql`${rumSessions.errors} = 0` : undefined,
          text
            ? or(
                ilike(rumSessions.entryUrl, text),
                ilike(rumSessions.userEmail, text),
                ilike(rumSessions.userName, text),
                ilike(rumSessions.userId, text),
              )
            : undefined,
        ),
      )
      .orderBy(desc(rumSessions.lastSeenAt))
      .limit(q.limit);
    return rows.map((r) => sessionView(r.s, r.appName));
  }

  private async findSession(actor: ActorContext, id: string) {
    const [row] = await this.db
      .select({ s: rumSessions, appName: rumApplications.name })
      .from(rumSessions)
      .innerJoin(rumApplications, eq(rumApplications.id, rumSessions.appId))
      .where(and(eq(rumSessions.id, id), eq(rumSessions.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Session');
    return row;
  }

  async session(actor: ActorContext, id: string): Promise<RumSessionDetail> {
    const { s, appName } = await this.findSession(actor, id);
    const events = await this.db
      .select()
      .from(rumEvents)
      .where(eq(rumEvents.sessionId, id))
      .orderBy(asc(rumEvents.ts), asc(rumEvents.id))
      .limit(1000);
    return {
      ...sessionView(s, appName),
      events: events.map((e): RumEventView => ({
        id: e.id,
        ts: e.ts.toISOString(),
        type: e.type as RumEventType,
        name: e.name,
        url: e.url,
        value: e.value,
        props: e.props,
      })),
    };
  }

  async replay(actor: ActorContext, id: string): Promise<RumReplay> {
    const { s } = await this.findSession(actor, id);
    const rows = await this.db
      .select()
      .from(rumReplay)
      .where(eq(rumReplay.sessionId, id))
      .orderBy(asc(rumReplay.ts), asc(rumReplay.id));
    return {
      viewport: s.viewportW && s.viewportH ? { w: s.viewportW, h: s.viewportH } : null,
      startedAt: s.startedAt.toISOString(),
      snapshots: rows
        .filter((r) => r.kind === 'snapshot')
        .map((r) => ({ ts: r.ts.getTime(), html: r.html ?? '', url: r.url })),
      moves: rows
        .filter((r) => r.kind === 'moves')
        .flatMap((r) => r.moves ?? [])
        .map((m) => ({ ts: m.ts, t: m.t as 'm' | 'c' | 's', x: m.x, y: m.y }))
        .sort((a, b) => a.ts - b.ts),
    };
  }

  async overview(
    actor: ActorContext,
    q: { appId?: string; minutes: number },
  ): Promise<RumOverview> {
    const from = this.since(q.minutes);
    const sessionWhere = and(
      eq(rumSessions.workspaceId, actor.workspaceId),
      gte(rumSessions.lastSeenAt, from),
      q.appId ? eq(rumSessions.appId, q.appId) : undefined,
    );
    const eventWhere = and(
      eq(rumEvents.workspaceId, actor.workspaceId),
      gte(rumEvents.ts, from),
      q.appId ? eq(rumEvents.appId, q.appId) : undefined,
    );
    const bucketMs = (q.minutes * 60_000) / TREND_BUCKETS;
    const [totals] = await this.db
      .select({
        sessions: sql<number>`count(*)::int`,
        users: sql<number>`count(distinct ${rumSessions.userId})::int`,
        pageViews: sql<number>`coalesce(sum(${rumSessions.pageViews}), 0)::int`,
        errors: sql<number>`coalesce(sum(${rumSessions.errors}), 0)::int`,
      })
      .from(rumSessions)
      .where(sessionWhere);
    const vitals = await this.db
      .select({
        name: rumEvents.name,
        p75: sql<number | null>`percentile_cont(0.75) within group (order by ${rumEvents.value})`,
        samples: sql<number>`count(*)::int`,
      })
      .from(rumEvents)
      .where(and(eventWhere, eq(rumEvents.type, 'vital')))
      .groupBy(rumEvents.name);
    const trendRows = await this.db
      .select({
        bucket: sql<number>`least(${TREND_BUCKETS - 1}, floor(extract(epoch from (${rumEvents.ts} - ${from.toISOString()}::timestamptz)) * 1000 / ${bucketMs}))::int`,
        sessions: sql<number>`count(distinct ${rumEvents.sessionId})::int`,
        errors: sql<number>`(count(*) filter (where ${rumEvents.type} = 'error'))::int`,
      })
      .from(rumEvents)
      .where(eventWhere)
      .groupBy(sql`1`);
    const byBucket = new Map(trendRows.map((t) => [t.bucket, t]));
    const topPages = await this.db
      .select({ url: rumEvents.url, views: sql<number>`count(*)::int` })
      .from(rumEvents)
      .where(and(eventWhere, eq(rumEvents.type, 'pageview')))
      .groupBy(rumEvents.url)
      .orderBy(desc(sql`count(*)`))
      .limit(8);
    return {
      sessions: totals?.sessions ?? 0,
      users: totals?.users ?? 0,
      pageViews: totals?.pageViews ?? 0,
      errors: totals?.errors ?? 0,
      vitals: vitals.map((v) => ({
        name: v.name,
        p75: v.p75 === null ? null : Number(v.p75),
        samples: v.samples,
      })),
      trend: Array.from({ length: TREND_BUCKETS }, (_, i) => ({
        at: new Date(from.getTime() + i * bucketMs).toISOString(),
        sessions: byBucket.get(i)?.sessions ?? 0,
        errors: byBucket.get(i)?.errors ?? 0,
      })),
      topPages: topPages.map((p) => ({ url: p.url ?? '(unknown)', views: p.views })),
    };
  }

  async users(actor: ActorContext, q: { appId?: string; minutes: number }): Promise<RumUserView[]> {
    const rows = await this.db
      .select({
        userId: rumSessions.userId,
        name: sql<string | null>`max(${rumSessions.userName})`,
        email: sql<string | null>`max(${rumSessions.userEmail})`,
        sessions: sql<number>`count(*)::int`,
        errors: sql<number>`coalesce(sum(${rumSessions.errors}), 0)::int`,
        lastSeenAt: sql<Date>`max(${rumSessions.lastSeenAt})`,
      })
      .from(rumSessions)
      .where(
        and(
          eq(rumSessions.workspaceId, actor.workspaceId),
          gte(rumSessions.lastSeenAt, this.since(q.minutes)),
          sql`${rumSessions.userId} is not null`,
          q.appId ? eq(rumSessions.appId, q.appId) : undefined,
        ),
      )
      .groupBy(rumSessions.userId)
      .orderBy(desc(sql`max(${rumSessions.lastSeenAt})`))
      .limit(200);
    return rows.map((r) => ({
      userId: r.userId!,
      name: r.name,
      email: r.email,
      sessions: r.sessions,
      errors: r.errors,
      lastSeenAt: new Date(r.lastSeenAt).toISOString(),
    }));
  }

  async events(
    actor: ActorContext,
    q: { appId?: string; minutes: number },
  ): Promise<RumEventSummary[]> {
    const rows = await this.db
      .select({
        type: rumEvents.type,
        name: rumEvents.name,
        count: sql<number>`count(*)::int`,
        sessions: sql<number>`count(distinct ${rumEvents.sessionId})::int`,
      })
      .from(rumEvents)
      .where(
        and(
          eq(rumEvents.workspaceId, actor.workspaceId),
          gte(rumEvents.ts, this.since(q.minutes)),
          sql`${rumEvents.type} in ('custom', 'error', 'click')`,
          q.appId ? eq(rumEvents.appId, q.appId) : undefined,
        ),
      )
      .groupBy(rumEvents.type, rumEvents.name)
      .orderBy(desc(sql`count(*)`))
      .limit(100);
    return rows.map((r) => ({ ...r, type: r.type as RumEventType }));
  }

  private funnelView(r: typeof rumFunnels.$inferSelect): FunnelView {
    return {
      id: r.id,
      appId: r.appId,
      name: r.name,
      steps: r.steps as FunnelView['steps'],
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listFunnels(actor: ActorContext): Promise<FunnelView[]> {
    const rows = await this.db
      .select()
      .from(rumFunnels)
      .where(eq(rumFunnels.workspaceId, actor.workspaceId))
      .orderBy(asc(rumFunnels.createdAt));
    return rows.map((r) => this.funnelView(r));
  }

  async createFunnel(actor: ActorContext, input: CreateFunnelInput): Promise<FunnelView> {
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
      })
      .returning();
    return this.funnelView(row!);
  }

  async removeFunnel(actor: ActorContext, id: string): Promise<void> {
    const removed = await this.db
      .delete(rumFunnels)
      .where(and(eq(rumFunnels.id, id), eq(rumFunnels.workspaceId, actor.workspaceId)))
      .returning({ id: rumFunnels.id });
    if (removed.length === 0) throw notFound('Funnel');
  }

  async funnelResult(actor: ActorContext, id: string, minutes: number): Promise<FunnelResult> {
    const [row] = await this.db
      .select()
      .from(rumFunnels)
      .where(and(eq(rumFunnels.id, id), eq(rumFunnels.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Funnel');
    const funnel = this.funnelView(row);
    const names = funnel.steps.filter((s) => s.kind === 'event').map((s) => s.match);
    const events = await this.db
      .select({
        sessionId: rumEvents.sessionId,
        ts: rumEvents.ts,
        type: rumEvents.type,
        name: rumEvents.name,
        url: rumEvents.url,
      })
      .from(rumEvents)
      .where(
        and(
          eq(rumEvents.appId, row.appId),
          gte(rumEvents.ts, this.since(minutes)),
          or(
            eq(rumEvents.type, 'pageview'),
            names.length ? inArray(rumEvents.name, names) : undefined,
          ),
        ),
      )
      .limit(FUNNEL_EVENT_CAP);
    const reached = reachedPerStep(
      funnel.steps,
      events.map((e) => ({ ...e, ts: e.ts.getTime() })),
    );
    const first = reached[0] ?? 0;
    return {
      funnel,
      steps: funnel.steps.map((s, i) => ({
        label: s.label || `${s.kind === 'pageview' ? 'Visit' : 'Event'} ${s.match}`,
        sessions: reached[i]!,
        conversion: first ? Math.round(((reached[i] ?? 0) / first) * 1000) / 10 : 0,
        dropOff: i === 0 ? 0 : (reached[i - 1] ?? 0) - (reached[i] ?? 0),
      })),
    };
  }
}
