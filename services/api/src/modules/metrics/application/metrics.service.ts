import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type {
  CreateDashboardInput,
  DashboardVariable,
  DashboardView,
  DashboardWidget,
  MetricAgg,
  MetricBucket,
  MetricLabelKey,
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
import type { Grid } from '../domain/series-engine';
import { MetricQueryService } from './metric-query.service';

type DashboardRow = typeof dashboards.$inferSelect;

const BUCKETS = 60;
const MAX_GROUPS = 8;
const MAX_LABEL_KEYS = 10;
const MAX_LABEL_VALUES = 20;
const MAX_NAMES = 200;
const NAMES_WINDOW_MS = 7 * 24 * 3600 * 1000;

const toView = (row: DashboardRow): DashboardView => ({
  id: row.id,
  name: row.name,
  widgets: (row.widgets as unknown as DashboardWidget[]).map((w) => ({
    ...w,
    chart: w.chart ?? 'line',
  })),
  variables: row.variables as unknown as DashboardVariable[],
  createdAt: row.createdAt.toISOString(),
});

interface SeriesQuery {
  name: string;
  agg: MetricAgg;
  minutes: number;
  service?: string;
  groupBy?: string;
  filters?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class MetricsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly query: MetricQueryService,
  ) {}

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

  async labels(actor: ActorContext, name: string): Promise<MetricLabelKey[]> {
    const since = new Date(Date.now() - NAMES_WINDOW_MS);
    const rows = await this.db.execute<{ key: string; value: string }>(sql`
      select kv.key, kv.value from (
        select distinct (jsonb_each_text(${metricPoints.attributes})).* from ${metricPoints}
        where ${metricPoints.workspaceId} = ${actor.workspaceId}
          and ${metricPoints.name} = ${name} and ${metricPoints.ts} >= ${since.toISOString()}::timestamptz
        limit 500
      ) kv`);
    const byKey = new Map<string, string[]>();
    for (const r of rows.rows) {
      const list = byKey.get(r.key) ?? [];
      if (list.length < MAX_LABEL_VALUES) list.push(r.value);
      byKey.set(r.key, list);
    }
    return [...byKey].slice(0, MAX_LABEL_KEYS).map(([key, values]) => ({ key, values }));
  }

  async series(actor: ActorContext, q: SeriesQuery, now = new Date()): Promise<MetricSeries> {
    const to = q.to ? new Date(q.to) : now;
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - q.minutes * 60_000);
    const grid: Grid = {
      from: from.getTime(),
      bucketMs: Math.max(1000, (to.getTime() - from.getTime()) / BUCKETS),
      buckets: BUCKETS,
    };
    const result = await this.query.run(actor.workspaceId, { ...q, metric: q.name }, grid);
    const fill = (values: (number | null)[] | undefined): MetricBucket[] =>
      Array.from({ length: BUCKETS }, (_, i) => ({
        at: new Date(grid.from + i * grid.bucketMs).toISOString(),
        value: values?.[i] ?? null,
      }));
    const series: MetricSeries = {
      name: q.name,
      agg: q.agg,
      unit: result.unit,
      buckets: fill(result.total),
      ...(result.truncated ? { truncated: true } : {}),
    };
    if (q.groupBy)
      series.groups = [...result.groups.keys()]
        .sort()
        .slice(0, MAX_GROUPS)
        .map((key) => ({ key, buckets: fill(result.groups.get(key)) }));
    return series;
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
        variables: input.variables ?? [],
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
        ...(input.variables ? { variables: input.variables } : {}),
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
