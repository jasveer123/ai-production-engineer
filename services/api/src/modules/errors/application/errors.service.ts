import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type {
  ErrorGroupDetail,
  ErrorAssignee,
  ErrorGroupView,
  ErrorRelease,
  ErrorStatus,
  UpdateErrorInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { errorGroups, errorOccurrences, users, workspaceMembers } from '../../../core/db/schema';
import { SourceMapsService } from './source-maps.service';
import { breakdowns, latestEvent, replaySession, usersAffected } from './error-insights';

type Row = typeof errorGroups.$inferSelect;

const HOURS = 24;
const RECENT = 20;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const effectiveStatus = (r: Row, now = Date.now()): ErrorStatus =>
  r.status === 'snoozed' && r.snoozeUntil && r.snoozeUntil.getTime() <= now
    ? 'unresolved'
    : (r.status as ErrorStatus);

const toView = (r: Row, assignee: ErrorAssignee | null, users = 0): ErrorGroupView => ({
  assignee,
  id: r.id,
  title: r.title,
  errorType: r.errorType,
  message: r.message,
  service: r.service,
  environment: r.environment,
  status: effectiveStatus(r),
  count: r.count,
  firstSeenAt: r.firstSeenAt.toISOString(),
  lastSeenAt: r.lastSeenAt.toISOString(),
  release: r.release,
  incidentId: r.incidentId,
  reopenedAt: r.reopenedAt?.toISOString() ?? null,
  applicationId: r.applicationId,
  usersAffected: users,
  snoozeUntil: r.snoozeUntil?.toISOString() ?? null,
  snoozeRemaining: r.snoozeRemaining,
});

const statusFilter = (status: ErrorStatus) => {
  if (status === 'unresolved')
    return sql`(${errorGroups.status} in ('unresolved', 'regressed') or (${errorGroups.status} = 'snoozed' and ${errorGroups.snoozeUntil} <= now()))`;
  if (status === 'snoozed')
    return sql`(${errorGroups.status} = 'snoozed' and (${errorGroups.snoozeUntil} is null or ${errorGroups.snoozeUntil} > now()))`;
  return eq(errorGroups.status, status);
};

@Injectable()
export class ErrorsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly maps: SourceMapsService,
  ) {}

  private async assignees(rows: Row[]): Promise<Map<string, ErrorAssignee>> {
    const ids = [...new Set(rows.map((r) => r.assigneeId).filter((v): v is string => Boolean(v)))];
    if (ids.length === 0) return new Map();
    const found = await this.db
      .select({ userId: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, ids));
    return new Map(found.map((u) => [u.userId, u]));
  }

  async list(
    actor: ActorContext,
    q: {
      status?: ErrorStatus;
      service?: string;
      q?: string;
      assignee?: string;
      applicationId?: string;
      environment?: string;
      release?: string;
      limit: number;
    },
  ): Promise<ErrorGroupView[]> {
    const text = q.q ? `%${escapeLike(q.q)}%` : null;
    const rows = await this.db
      .select()
      .from(errorGroups)
      .where(
        and(
          eq(errorGroups.workspaceId, actor.workspaceId),
          q.status ? statusFilter(q.status) : undefined,
          q.service ? eq(errorGroups.service, q.service) : undefined,
          q.applicationId ? eq(errorGroups.applicationId, q.applicationId) : undefined,
          q.environment ? eq(errorGroups.environment, q.environment) : undefined,
          q.release
            ? sql`exists (select 1 from ${errorOccurrences} where ${errorOccurrences.groupId} = ${errorGroups.id} and ${errorOccurrences.release} = ${q.release})`
            : undefined,
          q.assignee === 'me' ? eq(errorGroups.assigneeId, actor.userId) : undefined,
          q.assignee === 'none' ? sql`${errorGroups.assigneeId} is null` : undefined,
          text ? or(ilike(errorGroups.title, text), ilike(errorGroups.message, text)) : undefined,
        ),
      )
      .orderBy(desc(errorGroups.lastSeenAt))
      .limit(q.limit);
    const [people, users] = await Promise.all([
      this.assignees(rows),
      usersAffected(
        this.db,
        rows.map((r) => r.id),
      ),
    ]);
    return rows.map((r) =>
      toView(r, r.assigneeId ? (people.get(r.assigneeId) ?? null) : null, users.get(r.id) ?? 0),
    );
  }

  private async find(actor: ActorContext, id: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(errorGroups)
      .where(and(eq(errorGroups.id, id), eq(errorGroups.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Error');
    return row;
  }

  async get(actor: ActorContext, id: string, now = new Date()): Promise<ErrorGroupDetail> {
    const row = await this.find(actor, id);
    const hourMs = 3600_000;
    const end = Math.floor(now.getTime() / hourMs) * hourMs + hourMs;
    const from = new Date(end - HOURS * hourMs);
    const [recent, buckets, people, symbolicated, users, extra, latest, rumSessionId] =
      await Promise.all([
        this.db
          .select()
          .from(errorOccurrences)
          .where(eq(errorOccurrences.groupId, id))
          .orderBy(desc(errorOccurrences.occurredAt))
          .limit(RECENT),
        this.db
          .select({
            bucket: sql<number>`floor(extract(epoch from (${errorOccurrences.occurredAt} - ${from.toISOString()}::timestamptz)) / 3600)::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(errorOccurrences)
          .where(and(eq(errorOccurrences.groupId, id), gte(errorOccurrences.occurredAt, from)))
          .groupBy(sql`1`),
        this.assignees([row]),
        this.maps.symbolicate(actor.workspaceId, row.release, row.stack),
        usersAffected(this.db, [id]),
        breakdowns(this.db, id),
        latestEvent(this.db, id),
        replaySession(this.db, actor.workspaceId, id),
      ]);
    const event = latest
      ? {
          ...latest.event,
          exceptions: await this.maps.mapExceptions(
            actor.workspaceId,
            latest.release,
            latest.event.exceptions,
          ),
        }
      : null;
    const byIndex = new Map(buckets.map((b) => [b.bucket, b.count]));
    return {
      ...toView(
        row,
        row.assigneeId ? (people.get(row.assigneeId) ?? null) : null,
        users.get(id) ?? 0,
      ),
      ...extra,
      latest: event,
      rumSessionId,
      stack: row.stack,
      symbolicated,
      route: row.route,
      occurrences: recent.map((o) => ({
        id: o.id,
        occurredAt: o.occurredAt.toISOString(),
        traceId: o.traceId,
        release: o.release,
        message: o.message,
      })),
      hourly: Array.from({ length: HOURS }, (_, i) => ({
        at: new Date(from.getTime() + i * hourMs).toISOString(),
        count: byIndex.get(i) ?? 0,
      })),
    };
  }

  async releases(actor: ActorContext): Promise<ErrorRelease[]> {
    const events = await this.db
      .select({
        release: errorOccurrences.release,
        events: sql<number>`count(*)::int`,
        errors: sql<number>`count(distinct ${errorOccurrences.groupId})::int`,
        firstAt: sql<Date>`min(${errorOccurrences.occurredAt})`,
        lastAt: sql<Date>`max(${errorOccurrences.occurredAt})`,
      })
      .from(errorOccurrences)
      .where(
        and(
          eq(errorOccurrences.workspaceId, actor.workspaceId),
          sql`${errorOccurrences.release} is not null`,
        ),
      )
      .groupBy(errorOccurrences.release)
      .orderBy(desc(sql`max(${errorOccurrences.occurredAt})`))
      .limit(50);
    const introduced = await this.db
      .select({ release: errorGroups.firstRelease, n: sql<number>`count(*)::int` })
      .from(errorGroups)
      .where(eq(errorGroups.workspaceId, actor.workspaceId))
      .groupBy(errorGroups.firstRelease);
    const newBy = new Map(introduced.map((r) => [r.release, r.n]));
    return events.map((e) => ({
      release: e.release!,
      events: e.events,
      errors: e.errors,
      newErrors: newBy.get(e.release) ?? 0,
      firstAt: new Date(e.firstAt).toISOString(),
      lastAt: new Date(e.lastAt).toISOString(),
    }));
  }

  private statusChange(current: Row, input: UpdateErrorInput): Partial<Row> {
    const snooze =
      input.status === 'snoozed'
        ? {
            snoozeUntil: input.snoozeMinutes
              ? new Date(Date.now() + input.snoozeMinutes * 60_000)
              : null,
            snoozeRemaining: input.snoozeOccurrences ?? null,
          }
        : { snoozeUntil: null, snoozeRemaining: null };
    return {
      status: input.status!,
      ...snooze,
      ...(input.status === 'unresolved' ? {} : { reopenedAt: null }),
      ...(input.status === 'resolved' ? { resolvedInRelease: current.release } : {}),
    };
  }

  async update(actor: ActorContext, id: string, input: UpdateErrorInput): Promise<ErrorGroupView> {
    const current = await this.find(actor, id);
    if (input.assigneeId) {
      const [member] = await this.db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, actor.workspaceId),
            eq(workspaceMembers.userId, input.assigneeId),
          ),
        );
      if (!member) throw notFound('Member');
    }
    const [row] = await this.db
      .update(errorGroups)
      .set({
        ...(input.status ? this.statusChange(current, input) : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      })
      .where(eq(errorGroups.id, id))
      .returning();
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: input.status ? `error.${input.status}` : 'error.assigned',
      resourceType: 'error',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {},
    });
    const [people, users] = await Promise.all([
      this.assignees([row!]),
      usersAffected(this.db, [id]),
    ]);
    return toView(
      row!,
      row!.assigneeId ? (people.get(row!.assigneeId) ?? null) : null,
      users.get(id) ?? 0,
    );
  }
}
