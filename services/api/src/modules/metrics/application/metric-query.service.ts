import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import type { MetricAgg } from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { metricPoints } from '../../../core/db/schema';
import { aggregateSeries, type Grid, type PointRow } from '../domain/series-engine';

export interface MetricQuery {
  metric: string;
  agg: MetricAgg;
  service?: string;
  groupBy?: string;
  filters?: string;
}

export interface MetricQueryResult {
  unit: string | null;
  total: (number | null)[] | undefined;
  groups: Map<string, (number | null)[]>;
  truncated: boolean;
}

// shortcut: aggregation runs in the API over at most this many raw points; move to SQL rollups when a query needs more.
const MAX_ROWS = 100_000;
const MAX_FILTERS = 10;

export function parseFilters(raw: string | undefined): { key: string; value: string }[] {
  return (raw ?? '')
    .split(',')
    .map((pair) => pair.split('='))
    .filter((p): p is [string, string] => p.length === 2 && Boolean(p[0]?.trim()))
    .slice(0, MAX_FILTERS)
    .map(([key, value]) => ({ key: key.trim(), value: value.trim() }));
}

function column(key: string): SQL<string> {
  if (key === 'service') return sql<string>`${metricPoints.service}`;
  if (key === 'environment') return sql<string>`${metricPoints.environment}`;
  return sql<string>`${metricPoints.attributes}->>${key}`;
}

function filterSql({ key, value }: { key: string; value: string }): SQL {
  if (!value.endsWith('*')) return sql`${column(key)} = ${value}`;
  const prefix = value.slice(0, -1).replace(/[\\%_]/g, (c) => `\\${c}`);
  return sql`${column(key)} like ${`${prefix}%`}`;
}

@Injectable()
export class MetricQueryService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async run(workspaceId: string, q: MetricQuery, grid: Grid): Promise<MetricQueryResult> {
    const from = new Date(grid.from - grid.bucketMs);
    const to = new Date(grid.from + grid.bucketMs * grid.buckets);
    const group = q.groupBy
      ? sql<string>`coalesce(${column(q.groupBy)}, '(none)')`
      : sql<string>`''`;
    const rows = await this.db
      .select({
        ts: metricPoints.ts,
        seriesKey: sql<string>`coalesce(${metricPoints.seriesKey}, md5(${metricPoints.service} || ${metricPoints.environment} || ${metricPoints.attributes}::text))`,
        group,
        kind: metricPoints.kind,
        unit: metricPoints.unit,
        temporality: metricPoints.temporality,
        monotonic: metricPoints.monotonic,
        startTs: metricPoints.startTs,
        value: metricPoints.value,
        histogram: metricPoints.histogram,
      })
      .from(metricPoints)
      .where(
        and(
          eq(metricPoints.workspaceId, workspaceId),
          eq(metricPoints.name, q.metric),
          gte(metricPoints.ts, from),
          lt(metricPoints.ts, to),
          q.service ? eq(metricPoints.service, q.service) : undefined,
          ...parseFilters(q.filters).map(filterSql),
        ),
      )
      .orderBy(asc(metricPoints.ts))
      .limit(MAX_ROWS + 1);
    const truncated = rows.length > MAX_ROWS;
    const points: PointRow[] = rows.slice(0, MAX_ROWS);
    const whole = aggregateSeries(
      points.map((p) => ({ ...p, group: '' })),
      grid,
      q.agg,
    );
    return {
      unit: rows[0]?.unit ?? null,
      total: whole.get(''),
      groups: q.groupBy
        ? aggregateSeries(points, grid, q.agg)
        : new Map<string, (number | null)[]>(),
      truncated,
    };
  }
}
