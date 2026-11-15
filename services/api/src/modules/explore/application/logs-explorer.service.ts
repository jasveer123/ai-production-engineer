import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, gt, gte, lte, sql, type SQL } from 'drizzle-orm';
import type {
  LevelBucket,
  LogContext,
  LogExploreQuery,
  LogExploreResult,
  LogFacets,
  LogFacetsQuery,
  TailQuery,
  TailResult,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { logRecords } from '../../../core/db/schema';
import { toLogLine } from '../../../ingest/collector/infrastructure/log-search';
import { bucketWidth, decodeCursor, encodeCursor, type TimeWindow } from '../domain/range';
import { LOG_SCHEMA } from '../infrastructure/query-schemas';
import { bounded, compileInput, MATCH_CAP, metaOf, windowOf } from './query-input';

const BUCKETS = 60;
const FACET_SAMPLE = 5000;
const FACET_FIELDS = ['level', 'service', 'environment', 'host'] as const;
const PLAIN_COLUMNS: Record<string, string> = {
  env: 'environment',
  way: 'way',
  source: 'way',
  trace: 'trace_id',
  trace_id: 'trace_id',
  span: 'span_id',
};

type Q<T> = Required<Pick<T, Extract<keyof T, 'q' | 'limit'>>> & T;

@Injectable()
export class LogsExplorerService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private where(workspaceId: string, window: TimeWindow, q: string): SQL[] {
    return [
      eq(logRecords.workspaceId, workspaceId),
      gte(logRecords.ts, window.from),
      lte(logRecords.ts, window.to),
      ...compileInput(q, LOG_SCHEMA),
    ];
  }

  async search(workspaceId: string, query: Q<LogExploreQuery>): Promise<LogExploreResult> {
    const started = Date.now();
    const window = windowOf(query);
    const where = this.where(workspaceId, window, query.q);
    const cursor = decodeCursor(query.cursor);
    const page = cursor
      ? [
          ...where,
          sql`(${logRecords.ts}, ${logRecords.id}) < (${cursor.ts}::timestamptz, ${cursor.id})`,
        ]
      : where;
    const bucketMs = bucketWidth(window, BUCKETS);

    return bounded(this.db, async (tx) => {
      const rows = await tx
        .select({ ...getTableColumns(logRecords), tsText: sql<string>`${logRecords.ts}::text` })
        .from(logRecords)
        .where(and(...page))
        .orderBy(desc(logRecords.ts), desc(logRecords.id))
        .limit(query.limit + 1);
      const [histogram, matched] = await Promise.all([
        this.histogram(tx, where, window, bucketMs),
        this.countCapped(tx, where),
      ]);
      const more = rows.length > query.limit;
      const kept = rows.slice(0, query.limit);
      const last = kept[kept.length - 1];
      return {
        lines: kept.map(toLogLine),
        nextCursor: more && last ? encodeCursor({ ts: last.tsText, id: last.id }) : null,
        histogram,
        bucketMs,
        meta: metaOf(window, started, matched, kept.length, more),
      };
    });
  }

  private async countCapped(tx: Tx, where: SQL[]): Promise<number> {
    const inner = tx
      .select({ one: sql`1`.as('one') })
      .from(logRecords)
      .where(and(...where))
      .limit(MATCH_CAP + 1)
      .as('m');
    const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(inner);
    return row?.n ?? 0;
  }

  private async histogram(
    tx: Tx,
    where: SQL[],
    window: TimeWindow,
    bucketMs: number,
  ): Promise<LevelBucket[]> {
    const rows = await tx
      .select({
        bucket: sql<number>`floor(extract(epoch from (${logRecords.ts} - ${window.from.toISOString()}::timestamptz)) * 1000 / ${bucketMs})::int`,
        level: logRecords.level,
        n: sql<number>`count(*)::int`,
      })
      .from(logRecords)
      .where(and(...where))
      .groupBy(sql`1`, logRecords.level);
    const out: LevelBucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
      at: new Date(window.from.getTime() + i * bucketMs).toISOString(),
      total: 0,
      levels: {},
    }));
    for (const r of rows) {
      const b = out[Math.min(BUCKETS - 1, Math.max(0, r.bucket))]!;
      b.total += r.n;
      b.levels[r.level] = (b.levels[r.level] ?? 0) + r.n;
    }
    return out;
  }

  async facets(workspaceId: string, query: Q<LogFacetsQuery>): Promise<LogFacets> {
    const window = windowOf(query);
    const where = and(...this.where(workspaceId, window, query.q));
    const extra =
      query.field && !(FACET_FIELDS as readonly string[]).includes(query.field)
        ? query.field
        : null;
    const known = extra ? PLAIN_COLUMNS[extra] : undefined;
    const extraValue = known
      ? sql.identifier(known)
      : sql`coalesce(attributes ->> ${extra}, attributes #>> string_to_array(${extra}, '.'))`;
    const extraSelect = extra
      ? sql`union all select ${extra}, (${extraValue})::text, count(*) from s group by 2`
      : sql``;
    const result = await bounded(this.db, (tx) =>
      tx.execute<{ f: string; v: string | null; n: string }>(sql`
        with s as (
          select * from ${logRecords} where ${where} order by ${logRecords.ts} desc limit ${FACET_SAMPLE}
        )
        select 'level' f, level v, count(*) n from s group by 2
        union all select 'service', service, count(*) from s group by 2
        union all select 'environment', environment, count(*) from s group by 2
        union all select 'host', host, count(*) from s group by 2
        union all select '@keys', k, count(*) from s, jsonb_object_keys(
          case when jsonb_typeof(s.attributes) = 'object' then s.attributes else '{}'::jsonb end
        ) k group by 2
        ${extraSelect}
      `),
    );
    const groups = new Map<string, { value: string; count: number }[]>();
    let sampled = 0;
    for (const r of result.rows) {
      if (r.v === null) continue;
      const list = groups.get(r.f) ?? [];
      list.push({ value: r.v, count: Number(r.n) });
      groups.set(r.f, list);
      if (r.f === 'level') sampled += Number(r.n);
    }
    const top = (f: string, n: number) =>
      (groups.get(f) ?? []).sort((a, b) => b.count - a.count).slice(0, n);
    const fields = [...FACET_FIELDS, ...(extra ? [extra] : [])].map((field) => ({
      field,
      values: top(field, 10),
    }));
    return { fields, attributeKeys: top('@keys', 30), sampled };
  }

  async context(workspaceId: string, id: number, size: number): Promise<LogContext> {
    const [anchor] = await this.db
      .select({ ...getTableColumns(logRecords), tsText: sql<string>`${logRecords.ts}::text` })
      .from(logRecords)
      .where(and(eq(logRecords.workspaceId, workspaceId), eq(logRecords.id, id)));
    if (!anchor) throw notFound('Log line');
    const same = [
      eq(logRecords.workspaceId, workspaceId),
      eq(logRecords.service, anchor.service),
      eq(logRecords.environment, anchor.environment),
      gte(logRecords.ts, new Date(anchor.ts.getTime() - 24 * 3600 * 1000)),
      lte(logRecords.ts, new Date(anchor.ts.getTime() + 24 * 3600 * 1000)),
    ];
    const pivot = sql`(${anchor.tsText}::timestamptz, ${anchor.id}::bigint)`;
    const [before, after] = await Promise.all([
      this.db
        .select()
        .from(logRecords)
        .where(and(...same, sql`(${logRecords.ts}, ${logRecords.id}) < ${pivot}`))
        .orderBy(desc(logRecords.ts), desc(logRecords.id))
        .limit(size),
      this.db
        .select()
        .from(logRecords)
        .where(and(...same, sql`(${logRecords.ts}, ${logRecords.id}) > ${pivot}`))
        .orderBy(asc(logRecords.ts), asc(logRecords.id))
        .limit(size),
    ]);
    return {
      anchor: toLogLine(anchor),
      before: before.reverse().map(toLogLine),
      after: after.map(toLogLine),
    };
  }

  async tail(workspaceId: string, query: Q<TailQuery>): Promise<TailResult> {
    const filters = [eq(logRecords.workspaceId, workspaceId), ...compileInput(query.q, LOG_SCHEMA)];
    // shortcut: ids are insertion order; a row committed late with a lower id can be skipped, move to a received_at watermark if that shows up
    if (query.after === undefined) {
      const rows = await bounded(this.db, (tx) =>
        tx
          .select()
          .from(logRecords)
          .where(and(...filters, gte(logRecords.receivedAt, new Date(Date.now() - 3600_000))))
          .orderBy(desc(logRecords.id))
          .limit(query.limit),
      );
      const [maxRow] = await this.db
        .select({ id: sql<number>`coalesce(max(${logRecords.id}), 0)::bigint` })
        .from(logRecords)
        .where(eq(logRecords.workspaceId, workspaceId));
      return { lines: rows.reverse().map(toLogLine), cursor: Number(maxRow?.id ?? 0), gap: false };
    }
    const rows = await bounded(this.db, (tx) =>
      tx
        .select()
        .from(logRecords)
        .where(and(...filters, gt(logRecords.id, query.after!)))
        .orderBy(asc(logRecords.id))
        .limit(query.limit + 1),
    );
    if (rows.length <= query.limit) {
      const last = rows[rows.length - 1];
      return { lines: rows.map(toLogLine), cursor: last ? last.id : query.after, gap: false };
    }
    const latest = await this.db
      .select()
      .from(logRecords)
      .where(and(...filters, gt(logRecords.id, query.after)))
      .orderBy(desc(logRecords.id))
      .limit(query.limit);
    const cursor = latest[0]?.id ?? query.after;
    return { lines: latest.reverse().map(toLogLine), cursor, gap: true };
  }
}
