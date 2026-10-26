import { eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { IngestWay, LogLevel, LogLine } from '@ape/api-contracts';
import { logRecords } from '../db/schema';
import { likeEscape, type ParsedLogQuery } from './log-query';

export const HISTOGRAM_BUCKETS = 60;

/** The WHERE clauses for a log search: always this workspace and time window, plus the query. */
export function logFilters(
  workspaceId: string,
  window: { from: Date; to: Date },
  p: ParsedLogQuery,
): SQL[] {
  const where: SQL[] = [
    eq(logRecords.workspaceId, workspaceId),
    gte(logRecords.ts, window.from),
    lte(logRecords.ts, window.to),
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
  return where;
}

/** Fixed-size histogram from the per-bucket counts the database returned. */
export function histogramOf(
  counts: { bucket: number; total: number; errors: number }[],
  from: Date,
  bucketMs: number,
) {
  const histogram = Array.from({ length: HISTOGRAM_BUCKETS }, (_, i) => ({
    at: new Date(from.getTime() + i * bucketMs).toISOString(),
    total: 0,
    errors: 0,
  }));
  for (const h of counts) {
    const b = histogram[Math.min(HISTOGRAM_BUCKETS - 1, Math.max(0, Number(h.bucket)))];
    if (b) {
      b.total += Number(h.total);
      b.errors += Number(h.errors);
    }
  }
  return histogram;
}

export function toLogLine(r: typeof logRecords.$inferSelect): LogLine {
  return {
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
  };
}
