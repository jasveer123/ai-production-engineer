import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type {
  CreateDashboardInput,
  DashboardView,
  DashboardWidget,
  MetricAgg,
  MetricKind,
  MetricName,
  MetricSeries,
  UpdateDashboardInput,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { dashboards, metricPoints } from '../../../core/db/schema';

type DashboardRow = typeof dashboards.$inferSelect;

const BUCKETS = 60;
const MAX_NAMES = 200;
const NAMES_WINDOW_MS = 7 * 24 * 3600 * 1000;

const toView = (row: DashboardRow): DashboardView => ({
  id: row.id,
  name: row.name,
  widgets: row.widgets as unknown as DashboardWidget[],
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class MetricsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async names(actor: ActorContext): Promise<MetricName[]> {
    const since = new Date(Date.now() - NAMES_WINDOW_MS);
    const rows = await this.db
      .select({
        name: metricPoints.name,
        kind: sql<MetricKind>`max(${metricPoints.kind})`,
        unit: sql<string | null>`max(${metricPoints.unit})`,
        services: sql<string[]>`array_agg(distinct ${metricPoints.service})`,
        points: sql<number>`count(*)::int`,
        lastAt: sql<Date>`max(${metricPoints.ts})`,
      })
      .from(metricPoints)
      .where(and(eq(metricPoints.workspaceId, actor.workspaceId), gte(metricPoints.ts, since)))
      .groupBy(metricPoints.name)
      .orderBy(asc(metricPoints.name))
      .limit(MAX_NAMES);
    return rows.map((r) => ({ ...r, lastAt: new Date(r.lastAt).toISOString() }));
  }

  async series(
    actor: ActorContext,
    q: { name: string; agg: MetricAgg; minutes: number; service?: string },
    now = new Date(),
  ): Promise<MetricSeries> {
    const windowMs = q.minutes * 60_000;
    const from = new Date(now.getTime() - windowMs);
    const bucketSec = windowMs / BUCKETS / 1000;
    const bucket = sql<number>`least(${BUCKETS - 1}, floor(extract(epoch from (${metricPoints.ts} - ${from.toISOString()}::timestamptz)) / ${bucketSec}))::int`;
    const value: Record<MetricAgg, ReturnType<typeof sql<number>>> = {
      avg: sql<number>`avg(${metricPoints.value})`,
      max: sql<number>`max(${metricPoints.value})`,
      min: sql<number>`min(${metricPoints.value})`,
      sum: sql<number>`sum(${metricPoints.value})`,
      count: sql<number>`count(*)`,
      rate: sql<number>`greatest(0, max(${metricPoints.value}) - min(${metricPoints.value})) / ${bucketSec}`,
    };
    const rows = await this.db
      .select({
        bucket,
        value: value[q.agg],
        unit: sql<string | null>`max(${metricPoints.unit})`,
      })
      .from(metricPoints)
      .where(
        and(
          eq(metricPoints.workspaceId, actor.workspaceId),
          eq(metricPoints.name, q.name),
          gte(metricPoints.ts, from),
          q.service ? eq(metricPoints.service, q.service) : undefined,
        ),
      )
      .groupBy(sql`1`);
    const byIndex = new Map(rows.map((r) => [r.bucket, Number(r.value)]));
    return {
      name: q.name,
      agg: q.agg,
      unit: rows[0]?.unit ?? null,
      buckets: Array.from({ length: BUCKETS }, (_, i) => ({
        at: new Date(from.getTime() + i * bucketSec * 1000).toISOString(),
        value: byIndex.get(i) ?? null,
      })),
    };
  }

  async listDashboards(actor: ActorContext): Promise<DashboardView[]> {
    const rows = await this.db
      .select()
      .from(dashboards)
      .where(eq(dashboards.workspaceId, actor.workspaceId))
      .orderBy(asc(dashboards.createdAt));
    return rows.map(toView);
  }

  async createDashboard(actor: ActorContext, input: CreateDashboardInput): Promise<DashboardView> {
    const [row] = await this.db
      .insert(dashboards)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        widgets: input.widgets ?? [],
        createdBy: actor.userId,
      })
      .returning();
    return toView(row!);
  }

  async updateDashboard(
    actor: ActorContext,
    id: string,
    input: UpdateDashboardInput,
  ): Promise<DashboardView> {
    const [row] = await this.db
      .update(dashboards)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.widgets ? { widgets: input.widgets } : {}),
      })
      .where(and(eq(dashboards.id, id), eq(dashboards.workspaceId, actor.workspaceId)))
      .returning();
    if (!row) throw notFound('Dashboard');
    return toView(row);
  }

  async removeDashboard(actor: ActorContext, id: string): Promise<void> {
    const removed = await this.db
      .delete(dashboards)
      .where(and(eq(dashboards.id, id), eq(dashboards.workspaceId, actor.workspaceId)))
      .returning({ id: dashboards.id });
    if (removed.length === 0) throw notFound('Dashboard');
  }
}
