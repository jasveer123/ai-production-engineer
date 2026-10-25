import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  INGEST_WAYS,
  type IngestOverview,
  type IngestStream,
  type IngestWay,
  type LogLevel,
  type LogLine,
  type LogQuery,
  type LogSearchResult,
  type StreamState,
} from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { ingestStreams, logRecords, spans } from '../db/schema';
import { IngestTokensService } from './ingest-tokens.service';
import { likeEscape, parseLogQuery } from './log-query';
import { SyslogServer } from './syslog.server';

export const RECEIVING_MS = 5 * 60 * 1000;
export const SILENT_MS = 15 * 60 * 1000;

/** receiving: data in the last 5 min; silent: none for 15 min; in between it still counts as receiving. */
export function streamState(lastReceivedAt: Date | null, now = Date.now()): StreamState {
  if (!lastReceivedAt) return 'not_set_up';
  return now - lastReceivedAt.getTime() > SILENT_MS ? 'silent' : 'receiving';
}

const HISTOGRAM_BUCKETS = 60;

@Injectable()
export class IngestService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly tokens: IngestTokensService,
    private readonly syslog: SyslogServer,
  ) {}

  get ingestUrl(): string {
    return (this.env.PUBLIC_INGEST_URL ?? this.env.PUBLIC_API_URL).replace(/\/$/, '');
  }

  async overview(workspaceId: string): Promise<IngestOverview> {
    const [tokens, rows] = await Promise.all([
      this.tokens.list(workspaceId),
      this.db
        .select()
        .from(ingestStreams)
        .where(eq(ingestStreams.workspaceId, workspaceId))
        .orderBy(desc(ingestStreams.lastReceivedAt)),
    ]);
    const now = Date.now();
    const streams: IngestStream[] = rows.map((r) => ({
      way: r.way as IngestWay,
      serviceName: r.serviceName,
      environment: r.environment,
      host: r.host,
      state: streamState(r.lastReceivedAt, now),
      firstReceivedAt: r.firstReceivedAt.toISOString(),
      lastReceivedAt: r.lastReceivedAt.toISOString(),
      logCount: r.logCount,
      spanCount: r.spanCount,
      errorCount: r.errorCount,
      metricCount: r.metricCount,
    }));
    // Syslog is how Render and rsyslog reach Way 5, so it counts towards "drain".
    const ways = INGEST_WAYS.map((way) => {
      const mine = rows.filter((r) => r.way === way || (way === 'drain' && r.way === 'syslog'));
      const last = mine.reduce<Date | null>(
        (m, r) => (!m || r.lastReceivedAt > m ? r.lastReceivedAt : m),
        null,
      );
      return { way, state: streamState(last, now), lastReceivedAt: last?.toISOString() ?? null };
    });
    return {
      ingestUrl: this.ingestUrl,
      syslog: this.env.SYSLOG_ENABLED
        ? { host: this.env.SYSLOG_PUBLIC_HOST, port: this.env.SYSLOG_PORT, tls: this.syslog.tls }
        : null,
      tokens,
      ways,
      streams,
    };
  }

  async searchLogs(
    workspaceId: string,
    query: Required<Pick<LogQuery, 'q' | 'limit'>> & LogQuery,
  ): Promise<LogSearchResult> {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 60 * 60 * 1000);
    const p = parseLogQuery(query.q);

    const where: SQL[] = [
      eq(logRecords.workspaceId, workspaceId),
      gte(logRecords.ts, from),
      lte(logRecords.ts, to),
    ];
    if (p.levels.length) where.push(inArray(logRecords.level, p.levels));
    if (p.services.length) where.push(inArray(sql`lower(${logRecords.service})`, p.services));
    if (p.environments.length)
      where.push(inArray(sql`lower(${logRecords.environment})`, p.environments));
    if (p.hosts.length) where.push(inArray(sql`lower(${logRecords.host})`, p.hosts));
    if (p.ways.length) where.push(inArray(logRecords.way, p.ways));
    if (p.traceIds.length)
      where.push(or(...p.traceIds.map((t) => ilike(logRecords.traceId, `${likeEscape(t)}%`)))!);
    for (const t of p.text) where.push(ilike(logRecords.message, `%${likeEscape(t)}%`));

    const page = query.before ? [...where, lt(logRecords.id, query.before)] : where;
    const rows = await this.db
      .select()
      .from(logRecords)
      .where(and(...page))
      .orderBy(desc(logRecords.ts), desc(logRecords.id))
      .limit(query.limit + 1);

    const bucketMs = Math.max(1000, Math.ceil((to.getTime() - from.getTime()) / HISTOGRAM_BUCKETS));
    const [hist, services] = await Promise.all([
      this.db
        .select({
          bucket: sql<number>`floor(extract(epoch from (${logRecords.ts} - ${from.toISOString()}::timestamptz)) * 1000 / ${bucketMs})::int`,
          total: sql<number>`count(*)::int`,
          errors: sql<number>`count(*) filter (where ${logRecords.level} in ('error','fatal'))::int`,
        })
        .from(logRecords)
        .where(and(...where))
        .groupBy(sql`1`),
      this.db
        .selectDistinct({ service: logRecords.service })
        .from(logRecords)
        .where(
          and(
            eq(logRecords.workspaceId, workspaceId),
            gte(logRecords.ts, new Date(Date.now() - 24 * 3600 * 1000)),
          ),
        )
        .orderBy(asc(logRecords.service))
        .limit(200),
    ]);
    const histogram = Array.from({ length: HISTOGRAM_BUCKETS }, (_, i) => ({
      at: new Date(from.getTime() + i * bucketMs).toISOString(),
      total: 0,
      errors: 0,
    }));
    for (const h of hist) {
      const b = histogram[Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Number(h.bucket)))];
      if (b) {
        b.total += Number(h.total);
        b.errors += Number(h.errors);
      }
    }

    const more = rows.length > query.limit;
    const lines: LogLine[] = rows.slice(0, query.limit).map((r) => ({
      id: r.id,
      ts: r.ts.toISOString(),
      service: r.service,
      environment: r.environment,
      level: r.level as LogLevel,
      message: r.message,
      attributes: r.attributes,
      traceId: r.traceId,
      spanId: r.spanId,
      host: r.host,
      way: r.way as IngestWay,
    }));
    return {
      lines,
      histogram,
      nextBefore: more ? (lines[lines.length - 1]?.id ?? null) : null,
      services: services.map((s) => s.service),
    };
  }

  /** A stored trace, root first, for the trace view and as AI evidence. */
  async trace(workspaceId: string, traceId: string) {
    const rows = await this.db
      .select()
      .from(spans)
      .where(and(eq(spans.workspaceId, workspaceId), eq(spans.traceId, traceId.toLowerCase())))
      .orderBy(asc(spans.startTime))
      .limit(1000);
    return rows.map((s) => ({
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      service: s.service,
      name: s.name,
      kind: s.kind,
      start: s.startTime.toISOString(),
      durationMs: Number(s.durationMs),
      statusCode: s.statusCode,
      statusMessage: s.statusMessage,
      attributes: s.attributes,
      events: s.events,
    }));
  }
}
