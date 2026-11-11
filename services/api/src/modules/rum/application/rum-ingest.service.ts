import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { RumPayload } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { rumApplications, rumEvents, rumReplay, rumSessions } from '../../../core/db/schema';
import { redact } from '../../investigations/domain/redact';
import { parseAgent } from '../domain/user-agent';

const MAX_SNAPSHOTS_PER_SESSION = 120;
const WINDOW_PER_MINUTE = 300;
const PAST_MS = 24 * 3600 * 1000;
const FUTURE_MS = 5 * 60_000;

const plain = (s: string | undefined | null, max: number) => (s ? s.slice(0, max) : null);
const SENSITIVE_PARAM = /token|key|secret|pass|auth|sig|code|session|jwt|email/i;

const cleanUrl = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    for (const name of [...u.searchParams.keys()])
      if (SENSITIVE_PARAM.test(name)) u.searchParams.set(name, 'REDACTED');
    u.hash = '';
    return redact(u.toString()).text.slice(0, 2000);
  } catch {
    return redact(raw).text.slice(0, 2000);
  }
};

const clean = (s: string | undefined | null, max = 2000) =>
  s ? redact(s).text.slice(0, max) : null;

@Injectable()
export class RumIngestService {
  private readonly hits = new Map<string, { start: number; n: number }>();

  constructor(@Inject(DB) private readonly db: Database) {}

  private limit(key: string): void {
    const now = Date.now();
    const slot = this.hits.get(key);
    if (!slot || now - slot.start > 60_000) this.hits.set(key, { start: now, n: 1 });
    else if (++slot.n > WINDOW_PER_MINUTE)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', 'Too many requests');
    if (this.hits.size > 5000) this.hits.clear();
  }

  async ingest(appKey: string, payload: RumPayload, ua: string | undefined, ip: string) {
    this.limit(`${appKey}:${ip}`);
    const [app] = await this.db
      .select()
      .from(rumApplications)
      .where(eq(rumApplications.appKey, appKey));
    if (!app)
      throw new ApiException(HttpStatus.NOT_FOUND, 'unknown_app', 'Unknown application key');

    const now = Date.now();
    const clamp = (ts: number) => Math.min(now + FUTURE_MS, Math.max(now - PAST_MS, ts));
    const events = payload.events.map((e) => ({ ...e, ts: clamp(e.ts) }));
    const times = [
      ...events.map((e) => e.ts),
      ...(payload.replay?.snapshots ?? []).map((s) => clamp(s.ts)),
    ];
    const first = new Date(times.length ? Math.min(...times) : now);
    const last = new Date(times.length ? Math.max(...times, now - 1000) : now);
    const count = (type: string) => events.filter((e) => e.type === type).length;
    const agent = parseAgent(ua);
    const hasReplay =
      (payload.replay?.snapshots.length ?? 0) > 0 || (payload.replay?.moves.length ?? 0) > 0;

    const [session] = await this.db
      .insert(rumSessions)
      .values({
        workspaceId: app.workspaceId,
        appId: app.id,
        sessionKey: payload.sessionId,
        userId: plain(payload.userId, 120),
        userName: plain(payload.userName, 120),
        userEmail: plain(payload.userEmail, 200),
        startedAt: first,
        lastSeenAt: last,
        pageViews: count('pageview'),
        errors: count('error'),
        clicks: count('click'),
        entryUrl: cleanUrl(payload.url),
        browser: agent.browser,
        os: agent.os,
        device: agent.device,
        hasReplay,
        viewportW: payload.viewport?.w ?? null,
        viewportH: payload.viewport?.h ?? null,
      })
      .onConflictDoUpdate({
        target: [rumSessions.appId, rumSessions.sessionKey],
        set: {
          lastSeenAt: sql`greatest(${rumSessions.lastSeenAt}, excluded.last_seen_at)`,
          startedAt: sql`least(${rumSessions.startedAt}, excluded.started_at)`,
          pageViews: sql`${rumSessions.pageViews} + ${count('pageview')}`,
          errors: sql`${rumSessions.errors} + ${count('error')}`,
          clicks: sql`${rumSessions.clicks} + ${count('click')}`,
          userId: sql`coalesce(excluded.user_id, ${rumSessions.userId})`,
          userName: sql`coalesce(excluded.user_name, ${rumSessions.userName})`,
          userEmail: sql`coalesce(excluded.user_email, ${rumSessions.userEmail})`,
          hasReplay: sql`${rumSessions.hasReplay} or excluded.has_replay`,
          viewportW: sql`coalesce(excluded.viewport_w, ${rumSessions.viewportW})`,
          viewportH: sql`coalesce(excluded.viewport_h, ${rumSessions.viewportH})`,
        },
      })
      .returning();

    if (events.length)
      await this.db.insert(rumEvents).values(
        events.map((e) => ({
          workspaceId: app.workspaceId,
          appId: app.id,
          sessionId: session!.id,
          ts: new Date(e.ts),
          type: e.type,
          name: clean(e.name, 120) ?? '',
          url: cleanUrl(e.url),
          value: e.value ?? null,
          props: Object.fromEntries(
            Object.entries(e.props ?? {}).map(([k, v]) => [
              k,
              typeof v === 'string' ? clean(v, 300) : v,
            ]),
          ),
        })),
      );

    if (payload.replay?.snapshots.length) {
      const [{ n } = { n: 0 }] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(rumReplay)
        .where(eq(rumReplay.sessionId, session!.id));
      const room = Math.max(0, MAX_SNAPSHOTS_PER_SESSION - n);
      const rows = payload.replay.snapshots.slice(0, room).map((s) => ({
        sessionId: session!.id,
        ts: new Date(clamp(s.ts)),
        kind: 'snapshot',
        html: s.html,
        url: cleanUrl(s.url),
      }));
      if (rows.length) await this.db.insert(rumReplay).values(rows);
    }
    if (payload.replay?.moves.length)
      await this.db.insert(rumReplay).values({
        sessionId: session!.id,
        ts: new Date(clamp(payload.replay.moves[0]!.ts)),
        kind: 'moves',
        moves: payload.replay.moves,
      });
    return { accepted: events.length };
  }
}
