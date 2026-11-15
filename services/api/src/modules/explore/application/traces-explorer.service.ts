import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type {
  OperationStats,
  RangeQuery,
  TraceDetail,
  TraceSearchQuery,
  TraceSearchResult,
} from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { logRecords, spans } from '../../../core/db/schema';
import { toLogLine } from '../../../ingest/collector/infrastructure/log-search';
import { buildWaterfall } from '../domain/waterfall';
import type { TimeWindow } from '../domain/range';
import { SPAN_SCHEMA } from '../infrastructure/query-schemas';
import { bounded, compileInput, metaOf, windowOf } from './query-input';

const ERROR = 2;
const TRACE_SPAN_LIMIT = 2000;

interface TraceRow extends Record<string, unknown> {
  trace_id: string;
  start: Date;
  duration_ms: string;
  span_count: string;
  error: boolean;
  root_service: string | null;
  root_operation: string | null;
  services: string[];
  last: Date;
}

export function spanFilters(workspaceId: string, window: TimeWindow, q: string): SQL[] {
  return [
    eq(spans.workspaceId, workspaceId),
    gte(spans.startTime, window.from),
    lte(spans.startTime, window.to),
    ...compileInput(q, SPAN_SCHEMA),
  ];
}

@Injectable()
export class TracesExplorerService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async search(
    workspaceId: string,
    query: Required<Pick<TraceSearchQuery, 'q' | 'limit'>> & TraceSearchQuery,
  ): Promise<TraceSearchResult> {
    const started = Date.now();
    const window = windowOf(query);
    const where = and(...spanFilters(workspaceId, window, query.q));
    const before = query.before
      ? sql`having max(start_time) < ${query.before}::timestamptz`
      : sql``;
    const result = await bounded(this.db, (tx) =>
      tx.execute<TraceRow>(sql`
        with matched as (
          select trace_id, max(start_time) last from ${spans} where ${where}
          group by trace_id ${before} order by last desc limit ${query.limit + 1}
        )
        select s.trace_id, m.last,
          min(s.start_time) start,
          extract(epoch from (max(s.start_time + s.duration_ms * interval '1 millisecond') - min(s.start_time))) * 1000 duration_ms,
          count(*) span_count,
          bool_or(s.status_code = ${ERROR}) error,
          (array_agg(s.service order by s.start_time) filter (where s.parent_span_id is null))[1] root_service,
          (array_agg(s.name order by s.start_time) filter (where s.parent_span_id is null))[1] root_operation,
          array_agg(distinct s.service) services
        from ${spans} s join matched m on m.trace_id = s.trace_id
        where s.workspace_id = ${workspaceId}
        group by s.trace_id, m.last
        order by m.last desc
      `),
    );
    const more = result.rows.length > query.limit;
    const rows = result.rows.slice(0, query.limit);
    return {
      traces: rows.map((r) => ({
        traceId: r.trace_id,
        start: new Date(r.start).toISOString(),
        durationMs: Math.round(Number(r.duration_ms) * 1000) / 1000,
        spanCount: Number(r.span_count),
        error: r.error,
        rootService: r.root_service,
        rootOperation: r.root_operation,
        services: r.services,
      })),
      nextBefore: more ? new Date(rows[rows.length - 1]!.last).toISOString() : null,
      meta: metaOf(window, started, rows.length, rows.length, more),
    };
  }

  async detail(workspaceId: string, traceId: string): Promise<TraceDetail> {
    const id = traceId.toLowerCase();
    const [rows, logs] = await Promise.all([
      this.db
        .select()
        .from(spans)
        .where(and(eq(spans.workspaceId, workspaceId), eq(spans.traceId, id)))
        .orderBy(asc(spans.startTime))
        .limit(TRACE_SPAN_LIMIT + 1),
      this.db
        .select()
        .from(logRecords)
        .where(and(eq(logRecords.workspaceId, workspaceId), eq(logRecords.traceId, id)))
        .orderBy(asc(logRecords.ts), asc(logRecords.id))
        .limit(500),
    ]);
    const kept = rows.slice(0, TRACE_SPAN_LIMIT);
    const w = buildWaterfall(
      kept.map((s) => ({ ...s, start: s.startTime, durationMs: Number(s.durationMs) })),
    );
    return {
      traceId: id,
      start: w.start?.toISOString() ?? null,
      durationMs: w.durationMs,
      missingRoot: w.missingRoot,
      orphanCount: w.orphanCount,
      truncated: rows.length > TRACE_SPAN_LIMIT,
      logs: logs.map(toLogLine),
      spans: w.rows.map(({ span: s, depth, offsetMs, orphan }) => ({
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        service: s.service,
        environment: s.environment,
        name: s.name,
        kind: s.kind,
        start: s.startTime.toISOString(),
        offsetMs,
        durationMs: s.durationMs,
        statusCode: s.statusCode,
        statusMessage: s.statusMessage,
        attributes: s.attributes,
        events: s.events,
        depth,
        orphan,
      })),
    };
  }

  async operations(
    workspaceId: string,
    query: Required<Pick<RangeQuery, 'q'>> & RangeQuery,
  ): Promise<OperationStats[]> {
    const window = windowOf(query);
    const rows = await bounded(this.db, (tx) =>
      tx
        .select({
          service: spans.service,
          operation: spans.name,
          count: sql<number>`count(*)::int`,
          errors: sql<number>`count(*) filter (where ${spans.statusCode} = ${ERROR})::int`,
          p: sql<
            number[]
          >`percentile_cont(array[0.5, 0.95, 0.99]) within group (order by ${spans.durationMs})`,
        })
        .from(spans)
        .where(and(...spanFilters(workspaceId, window, query.q)))
        .groupBy(spans.service, spans.name)
        .orderBy(sql`count(*) desc`)
        .limit(100),
    );
    return rows.map((r) => ({
      service: r.service,
      operation: r.operation,
      count: r.count,
      errors: r.errors,
      p50: Number(r.p[0] ?? 0),
      p95: Number(r.p[1] ?? 0),
      p99: Number(r.p[2] ?? 0),
    }));
  }
}
