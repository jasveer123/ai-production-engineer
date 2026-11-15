import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { RangeQuery, ServiceMap } from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { spans } from '../../../core/db/schema';
import { bounded, windowOf } from './query-input';

const ERROR = 2;
const SERVER_KINDS = sql.raw('(2, 5)');
const CLIENT_KINDS = sql.raw('(3, 4)');

interface EdgeRow extends Record<string, unknown> {
  source: string;
  target: string;
  calls: string;
  errors: string;
  avg_ms: string;
  last_seen: Date;
  client_server: string;
}

@Injectable()
export class ServiceMapService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async map(workspaceId: string, query: RangeQuery): Promise<ServiceMap> {
    const window = windowOf(query);
    const inWindow = and(
      eq(spans.workspaceId, workspaceId),
      gte(spans.startTime, window.from),
      lte(spans.startTime, window.to),
    );
    const minutes = Math.max(1, (window.to.getTime() - window.from.getTime()) / 60_000);
    const entry = sql`(${spans.kind} in ${SERVER_KINDS} or ${spans.parentSpanId} is null)`;

    return bounded(this.db, async (tx) => {
      const red = await tx
        .select({
          service: spans.service,
          requests: sql<number>`count(*) filter (where ${entry})::int`,
          errors: sql<number>`count(*) filter (where ${entry} and ${spans.statusCode} = ${ERROR})::int`,
          p: sql<
            number[] | null
          >`percentile_cont(array[0.5, 0.95]) within group (order by ${spans.durationMs}) filter (where ${entry})`,
          lastSeen: sql<Date>`max(${spans.startTime})`,
        })
        .from(spans)
        .where(inWindow)
        .groupBy(spans.service);
      const edges = await tx.execute<EdgeRow>(sql`
        select p.service source, c.service target,
          count(*) calls,
          count(*) filter (where c.status_code = ${ERROR} or p.status_code = ${ERROR}) errors,
          avg(c.duration_ms) avg_ms,
          max(c.start_time) last_seen,
          count(*) filter (where p.kind in ${CLIENT_KINDS} or c.kind in ${SERVER_KINDS}) client_server
        from ${spans} c
        join ${spans} p on p.workspace_id = c.workspace_id and p.trace_id = c.trace_id and p.span_id = c.parent_span_id
        where c.workspace_id = ${workspaceId}
          and c.start_time >= ${window.from.toISOString()}::timestamptz
          and c.start_time <= ${window.to.toISOString()}::timestamptz
          and p.service <> c.service
        group by 1, 2
        order by 3 desc
        limit 500
      `);
      return {
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        services: red.map((r) => ({
          service: r.service,
          requests: r.requests,
          ratePerMin: r.requests / minutes,
          errors: r.errors,
          errorRate: r.requests ? r.errors / r.requests : 0,
          p50: Number(r.p?.[0] ?? 0),
          p95: Number(r.p?.[1] ?? 0),
          lastSeen: new Date(r.lastSeen).toISOString(),
        })),
        edges: edges.rows.map((e) => ({
          from: e.source,
          to: e.target,
          calls: Number(e.calls),
          errors: Number(e.errors),
          errorRate: Number(e.calls) ? Number(e.errors) / Number(e.calls) : 0,
          avgMs: Number(e.avg_ms),
          lastSeen: new Date(e.last_seen).toISOString(),
          confidence: Number(e.client_server) > 0 ? 'client_server' : 'parent_child',
        })),
      };
    });
  }
}
