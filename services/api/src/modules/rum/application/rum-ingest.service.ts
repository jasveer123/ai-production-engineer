import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq, lt, sql } from 'drizzle-orm';
import type { RumAppSettings, RumPayload } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  rumApplications,
  rumBatches,
  rumEvents,
  rumReplay,
  rumSessions,
} from '../../../core/db/schema';
import { WindowLimiter } from '../../errors/infrastructure/window-limiter';
import { redact } from '../../investigations/domain/redact';
import { enforceReplayPrivacy, sampled } from '../domain/privacy';
import { parseAgent } from '../domain/user-agent';

type App = typeof rumApplications.$inferSelect;

const MAX_SNAPSHOTS_PER_SESSION = 120;
const PER_MINUTE = 300;
const PAST_MS = 24 * 3600 * 1000;
const FUTURE_MS = 5 * 60_000;
const BATCH_RETENTION_MS = 48 * 3600 * 1000;

const plain = (s: string | undefined | null, max: number) => (s ? s.slice(0, max) : null);
const SENSITIVE_PARAM = /token|key|secret|pass|auth|sig|code|session|jwt|email/i;

export const cleanUrl = (raw: string | undefined | null): string | null => {
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

export interface IngestMeta {
  ua: string | undefined;
  ip: string;
  country: string | null;
}

export const settingsOf = (app: App): RumAppSettings => ({
  replayEnabled: app.replayEnabled,
  replaySampleRate: app.replaySampleRate,
  maskAllText: app.maskAllText,
  blockSelectors: app.blockSelectors,
});

@Injectable()
export class RumIngestService {
  private batches = 0;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly limiter: WindowLimiter,
  ) {}

  async app(appKey: string): Promise<App> {
    const [app] = await this.db
      .select()
      .from(rumApplications)
      .where(eq(rumApplications.appKey, appKey));
    if (!app)
      throw new ApiException(HttpStatus.NOT_FOUND, 'unknown_app', 'Unknown application key');
    return app;
  }

  async ingest(appKey: string, payload: RumPayload, meta: IngestMeta) {
    const gate = await this.limiter.hit(`rum:${appKey}:${meta.ip}`, PER_MINUTE);
    if (!gate.allowed)
      throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', 'Too many requests', {
        retryAfter: gate.retryAfter,
      });
    const app = await this.app(appKey);
    if (++this.batches % 1000 === 0)
      void this.db
        .delete(rumBatches)
        .where(lt(rumBatches.receivedAt, new Date(Date.now() - BATCH_RETENTION_MS)))
        .catch(() => undefined);
    return this.db.transaction((tx) => this.write(tx, app, payload, meta));
  }

  private async write(tx: Tx, app: App, payload: RumPayload, meta: IngestMeta) {
    if (payload.batchId) {
      const receipt = await tx
        .insert(rumBatches)
        .values({
          appId: app.id,
          batchId: payload.batchId,
          sessionKey: payload.sessionId,
          sequence: payload.sequence ?? 0,
        })
        .onConflictDoNothing()
        .returning({ id: rumBatches.id });
      if (receipt.length === 0) return { accepted: 0, duplicate: true, batchId: payload.batchId };
    }
    const now = Date.now();
    const clamp = (ts: number) => Math.min(now + FUTURE_MS, Math.max(now - PAST_MS, ts));
    const events = payload.events.map((e) => ({ ...e, ts: clamp(e.ts) }));
    const replayOn = app.replayEnabled && sampled(payload.sessionId, app.replaySampleRate);
    const replay = replayOn ? payload.replay : undefined;
    const times = [
      ...events.map((e) => e.ts),
      ...(replay?.snapshots ?? []).map((s) => clamp(s.ts)),
    ];
    const hasReplay = (replay?.snapshots.length ?? 0) > 0 || (replay?.moves.length ?? 0) > 0;
    const session = await this.upsertSession(tx, app, payload, meta, {
      startedAt: new Date(times.length ? Math.min(...times) : now),
      lastSeenAt: new Date(times.length ? Math.max(...times, now - 1000) : now),
      hasReplay,
    });
    const inserted = await this.insertEvents(tx, app, session.id, events);
    const count = (type: string) => inserted.filter((e) => e.type === type).length;
    await tx
      .update(rumSessions)
      .set({
        pageViews: sql`${rumSessions.pageViews} + ${count('pageview')}`,
        errors: sql`${rumSessions.errors} + ${count('error')}`,
        clicks: sql`${rumSessions.clicks} + ${count('click')}`,
        droppedEvents: sql`${rumSessions.droppedEvents} + ${payload.dropped ?? 0}`,
      })
      .where(eq(rumSessions.id, session.id));
    if (replay)
      await this.writeReplay(tx, session.id, replay, payload, (html) =>
        enforceReplayPrivacy(html, app.maskAllText),
      );
    return { accepted: inserted.length, duplicate: false, batchId: payload.batchId ?? null };
  }

  private async upsertSession(
    tx: Tx,
    app: App,
    payload: RumPayload,
    meta: IngestMeta,
    span: { startedAt: Date; lastSeenAt: Date; hasReplay: boolean },
  ) {
    const agent = parseAgent(meta.ua);
    const [session] = await tx
      .insert(rumSessions)
      .values({
        workspaceId: app.workspaceId,
        appId: app.id,
        sessionKey: payload.sessionId,
        userId: plain(payload.userId, 120),
        userName: plain(payload.userName, 120),
        userEmail: plain(payload.userEmail, 200),
        ...span,
        entryUrl: cleanUrl(payload.url),
        browser: agent.browser,
        os: agent.os,
        device: agent.device,
        viewportW: payload.viewport?.w ?? null,
        viewportH: payload.viewport?.h ?? null,
        country: meta.country,
      })
      .onConflictDoUpdate({
        target: [rumSessions.appId, rumSessions.sessionKey],
        set: {
          lastSeenAt: sql`greatest(${rumSessions.lastSeenAt}, excluded.last_seen_at)`,
          startedAt: sql`least(${rumSessions.startedAt}, excluded.started_at)`,
          userId: sql`coalesce(excluded.user_id, ${rumSessions.userId})`,
          userName: sql`coalesce(excluded.user_name, ${rumSessions.userName})`,
          userEmail: sql`coalesce(excluded.user_email, ${rumSessions.userEmail})`,
          hasReplay: sql`${rumSessions.hasReplay} or excluded.has_replay`,
          viewportW: sql`coalesce(excluded.viewport_w, ${rumSessions.viewportW})`,
          viewportH: sql`coalesce(excluded.viewport_h, ${rumSessions.viewportH})`,
          country: sql`coalesce(${rumSessions.country}, excluded.country)`,
        },
      })
      .returning();
    return session!;
  }

  private async insertEvents(
    tx: Tx,
    app: App,
    sessionId: string,
    events: RumPayload['events'],
  ): Promise<{ type: string }[]> {
    return events.length
      ? tx
          .insert(rumEvents)
          .values(
            events.map((e) => ({
              workspaceId: app.workspaceId,
              appId: app.id,
              sessionId,
              eventId: e.id ?? null,
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
          )
          .onConflictDoNothing()
          .returning({ type: rumEvents.type })
      : [];
  }

  private async writeReplay(
    tx: Tx,
    sessionId: string,
    replay: NonNullable<RumPayload['replay']>,
    payload: RumPayload,
    privacy: (html: string) => string,
  ) {
    const now = Date.now();
    const clamp = (ts: number) => Math.min(now + FUTURE_MS, Math.max(now - PAST_MS, ts));
    const seq = payload.sequence ?? null;
    const batchId = payload.batchId ?? null;
    if (replay.snapshots.length) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(rumReplay)
        .where(eq(rumReplay.sessionId, sessionId));
      const rows = replay.snapshots
        .slice(0, Math.max(0, MAX_SNAPSHOTS_PER_SESSION - n))
        .map((s) => ({
          sessionId,
          ts: new Date(clamp(s.ts)),
          kind: 'snapshot',
          html: privacy(s.html),
          url: cleanUrl(s.url),
          seq,
          batchId,
        }));
      if (rows.length) await tx.insert(rumReplay).values(rows);
    }
    if (replay.moves.length)
      await tx.insert(rumReplay).values({
        sessionId,
        ts: new Date(clamp(replay.moves[0]!.ts)),
        kind: 'moves',
        moves: replay.moves,
        seq,
        batchId,
      });
  }
}
