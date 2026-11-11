import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import type {
  ErrorGroupDetail,
  ErrorGroupView,
  ErrorStatus,
  UpdateErrorInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { errorGroups, errorOccurrences } from '../../../core/db/schema';

type Row = typeof errorGroups.$inferSelect;

const HOURS = 24;
const RECENT = 20;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const toView = (r: Row): ErrorGroupView => ({
  id: r.id,
  title: r.title,
  errorType: r.errorType,
  message: r.message,
  service: r.service,
  environment: r.environment,
  status: r.status as ErrorStatus,
  count: r.count,
  firstSeenAt: r.firstSeenAt.toISOString(),
  lastSeenAt: r.lastSeenAt.toISOString(),
  release: r.release,
  incidentId: r.incidentId,
  reopenedAt: r.reopenedAt?.toISOString() ?? null,
});

@Injectable()
export class ErrorsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: ActorContext,
    q: { status?: ErrorStatus; service?: string; q?: string; limit: number },
  ): Promise<ErrorGroupView[]> {
    const text = q.q ? `%${escapeLike(q.q)}%` : null;
    const rows = await this.db
      .select()
      .from(errorGroups)
      .where(
        and(
          eq(errorGroups.workspaceId, actor.workspaceId),
          q.status ? eq(errorGroups.status, q.status) : undefined,
          q.service ? eq(errorGroups.service, q.service) : undefined,
          text ? or(ilike(errorGroups.title, text), ilike(errorGroups.message, text)) : undefined,
        ),
      )
      .orderBy(desc(errorGroups.lastSeenAt))
      .limit(q.limit);
    return rows.map(toView);
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
    const [recent, buckets] = await Promise.all([
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
    ]);
    const byIndex = new Map(buckets.map((b) => [b.bucket, b.count]));
    return {
      ...toView(row),
      stack: row.stack,
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

  async setStatus(
    actor: ActorContext,
    id: string,
    input: UpdateErrorInput,
  ): Promise<ErrorGroupView> {
    await this.find(actor, id);
    const [row] = await this.db
      .update(errorGroups)
      .set({ status: input.status, ...(input.status === 'unresolved' ? {} : { reopenedAt: null }) })
      .where(eq(errorGroups.id, id))
      .returning();
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: `error.${input.status}`,
      resourceType: 'error',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {},
    });
    return toView(row!);
  }
}
