import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ApiException } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { errorApplications, errorGroups, errorOccurrences } from '../../../core/db/schema';
import { redact } from '../../investigations/domain/redact';
import {
  compareReleases,
  FINGERPRINT_VERSION,
  fingerprintOf,
  isRegression,
} from '../domain/grouping';
import {
  eventPayload,
  EnvelopeError,
  MAX_EVENT_BYTES,
  parseEnvelope,
} from '../domain/sentry-envelope';
import { normalizeSentryEvent, stackLines, type SentryOccurrence } from '../domain/sentry-event';
import { WindowLimiter } from '../infrastructure/window-limiter';

type App = typeof errorApplications.$inferSelect;
type Group = typeof errorGroups.$inferSelect;

export class SentryRateLimited extends Error {
  constructor(readonly retryAfter: number) {
    super('rate limited');
  }
}

const clean = (s: string) => redact(s).text;

@Injectable()
export class SentryIngestService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly limiter: WindowLimiter,
  ) {}

  async authenticate(projectId: string, key: string | null): Promise<App> {
    const id = Number(projectId);
    const [app] = Number.isSafeInteger(id)
      ? await this.db.select().from(errorApplications).where(eq(errorApplications.projectId, id))
      : [];
    if (!app || !key || app.publicKey !== key)
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'invalid_dsn', 'Unknown project or key');
    return app;
  }

  async envelope(app: App, body: Buffer): Promise<{ id: string | null }> {
    let events: Record<string, unknown>[];
    let headerId: string | null;
    try {
      const parsed = parseEnvelope(body);
      headerId = typeof parsed.header.event_id === 'string' ? parsed.header.event_id : null;
      events = parsed.items.map(eventPayload).filter((e): e is Record<string, unknown> => !!e);
    } catch (err) {
      if (err instanceof EnvelopeError)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_envelope', err.message);
      throw err;
    }
    for (const event of events) await this.accept(app, event);
    return { id: headerId ?? (events[0]?.event_id as string | undefined) ?? null };
  }

  async store(app: App, body: Buffer): Promise<{ id: string | null }> {
    if (body.length > MAX_EVENT_BYTES)
      throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, 'event_too_large', 'Event is too large');
    let event: unknown;
    try {
      event = JSON.parse(body.toString('utf8'));
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', 'Body is not valid JSON');
    }
    if (!event || typeof event !== 'object' || Array.isArray(event))
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', 'Event must be an object');
    await this.accept(app, event as Record<string, unknown>);
    return { id: ((event as Record<string, unknown>).event_id as string | undefined) ?? null };
  }

  private async accept(app: App, event: Record<string, unknown>): Promise<void> {
    const gate = await this.limiter.hit(`err:${app.id}`, app.rateLimitPerMinute);
    if (!gate.allowed) {
      await this.db
        .update(errorApplications)
        .set({ droppedEvents: sql`${errorApplications.droppedEvents} + 1` })
        .where(eq(errorApplications.id, app.id));
      throw new SentryRateLimited(gate.retryAfter);
    }
    const occ = normalizeSentryEvent(event);
    await this.db.transaction((tx) => this.record(tx, app, occ));
  }

  private async releaseStarts(tx: Tx, workspaceId: string, releases: string[]) {
    const rows = await tx
      .select({
        release: errorOccurrences.release,
        at: sql<Date>`min(${errorOccurrences.occurredAt})`,
      })
      .from(errorOccurrences)
      .where(
        and(
          eq(errorOccurrences.workspaceId, workspaceId),
          inArray(errorOccurrences.release, releases),
        ),
      )
      .groupBy(errorOccurrences.release);
    return new Map(rows.map((r) => [r.release!, new Date(r.at)]));
  }

  private async regresses(tx: Tx, group: Group, release: string | null): Promise<boolean> {
    if (group.status !== 'resolved') return false;
    const resolvedIn = group.resolvedInRelease;
    if (resolvedIn && release && compareReleases(release, resolvedIn) === null) {
      const starts = await this.releaseStarts(tx, group.workspaceId, [release, resolvedIn]);
      return isRegression(resolvedIn, release, (r) => starts.get(r) ?? null);
    }
    return isRegression(resolvedIn, release, () => null);
  }

  async record(tx: Tx, app: App, occ: SentryOccurrence): Promise<string | null> {
    const workspaceId = app.workspaceId;
    const externalEventId = `sentry:${app.id}:${occ.eventId ?? randomUUID()}`;
    const [dupe] = await tx
      .select({ id: errorOccurrences.id })
      .from(errorOccurrences)
      .where(
        and(
          eq(errorOccurrences.workspaceId, workspaceId),
          eq(errorOccurrences.externalEventId, externalEventId),
        ),
      )
      .limit(1);
    if (dupe) return null;
    const at = occ.occurredAt;
    const stack = stackLines(occ);
    const [group] = await tx
      .insert(errorGroups)
      .values({
        workspaceId,
        applicationId: app.id,
        fingerprint: fingerprintOf(app.id, occ),
        fingerprintVersion: FINGERPRINT_VERSION,
        title: clean(occ.title),
        errorType: occ.errorType,
        message: clean(occ.message).slice(0, 2000),
        service: app.name,
        environment: occ.environment,
        count: 0,
        firstSeenAt: at,
        lastSeenAt: at,
        release: occ.release,
        firstRelease: occ.release,
        route: occ.transaction ?? occ.request?.url ?? null,
        stack,
      })
      .onConflictDoUpdate({
        target: [errorGroups.workspaceId, errorGroups.fingerprint],
        set: { workspaceId: sql`${errorGroups.workspaceId}` },
      })
      .returning();
    const regress = await this.regresses(tx, group!, occ.release);
    const inserted = await tx
      .insert(errorOccurrences)
      .values({
        workspaceId,
        groupId: group!.id,
        occurredAt: at,
        traceId: (occ.contexts.trace as { trace_id?: string } | undefined)?.trace_id ?? null,
        release: occ.release,
        message: clean(occ.message).slice(0, 500),
        externalEventId,
        environment: occ.environment,
        userKey: occ.userKey,
        rumSessionKey: occ.rumSessionKey,
        tags: occ.tags,
        detail: {
          eventId: occ.eventId,
          level: occ.level,
          platform: occ.platform,
          exceptions: occ.exceptions.map((e) => ({ ...e, value: clean(e.value) })),
          breadcrumbs: occ.breadcrumbs.map((b) => ({
            ...b,
            message: b.message && clean(b.message),
          })),
          user: occ.user,
          contexts: occ.contexts,
          request: occ.request,
        },
      })
      .onConflictDoNothing()
      .returning({ id: errorOccurrences.id });
    if (inserted.length === 0) return null;
    await this.bump(tx, group!, occ, stack, regress);
    await tx
      .update(errorApplications)
      .set({ lastEventAt: new Date() })
      .where(eq(errorApplications.id, app.id));
    return group!.id;
  }

  private async bump(
    tx: Tx,
    group: Group,
    occ: SentryOccurrence,
    stack: string[],
    regress: boolean,
  ) {
    const at = occ.occurredAt.toISOString();
    const reg = sql.raw(regress ? 'true' : 'false');
    await tx
      .update(errorGroups)
      .set({
        count: sql`${errorGroups.count} + 1`,
        lastSeenAt: sql`greatest(${errorGroups.lastSeenAt}, ${at}::timestamptz)`,
        firstSeenAt: sql`least(${errorGroups.firstSeenAt}, ${at}::timestamptz)`,
        ...(occ.occurredAt >= group.lastSeenAt
          ? { stack: stack.length ? stack : group.stack, release: occ.release ?? group.release }
          : {}),
        status: sql`case
          when ${errorGroups.status} = 'snoozed' and (
            (${errorGroups.snoozeUntil} is not null and ${errorGroups.snoozeUntil} <= now())
            or (${errorGroups.snoozeRemaining} is not null and ${errorGroups.snoozeRemaining} <= 1)
          ) then 'unresolved'
          when ${errorGroups.status} = 'resolved' and ${reg} then 'regressed'
          else ${errorGroups.status} end`,
        snoozeRemaining: sql`case when ${errorGroups.status} = 'snoozed' and ${errorGroups.snoozeRemaining} is not null
          then ${errorGroups.snoozeRemaining} - 1 else ${errorGroups.snoozeRemaining} end`,
        reopenedAt: sql`case when ${errorGroups.status} = 'resolved' and ${reg}
          then ${at}::timestamptz else ${errorGroups.reopenedAt} end`,
      })
      .where(eq(errorGroups.id, group.id));
  }
}
