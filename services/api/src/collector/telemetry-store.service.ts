import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { inboundEvents, ingestStreams, integrations, logRecords, spans } from '../db/schema';
import { redact } from '../investigations/redact';
import type { Batch, ErrorInput } from './types';

export const INGEST_PROVIDER = 'ingest';
export const INGEST_ERROR_SOURCE = 'ingest_error';
const CHUNK = 500;

const redactText = (s: string) => redact(s).text;

/** Redacts every string value (attributes can carry headers, query strings and bodies). */
function redactDeep(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return redactText(v);
  if (depth > 4 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => redactDeep(x, depth + 1));
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).map(([k, x]) => [
      k,
      /pass(word)?|secret|token|api[-_]?key|authorization|cookie/i.test(k)
        ? '[REDACTED:secret]'
        : redactDeep(x, depth + 1),
    ]),
  );
}

interface Counts {
  logs: number;
  spans: number;
  errors: number;
  metrics: number;
  host: string | null;
  last: Date;
}

interface Bump {
  service: string;
  environment: string;
  key: keyof Omit<Counts, 'host' | 'last'>;
  n: number;
  at: Date;
  host?: string | null;
}

/** Per service and environment counts for one batch, written to the stream status afterwards. */
class StreamTally {
  readonly streams = new Map<string, Counts>();

  bump({ service, environment, key, n, at, host = null }: Bump): void {
    const k = `${service}\u0000${environment}`;
    const c = this.streams.get(k) ?? {
      logs: 0,
      spans: 0,
      errors: 0,
      metrics: 0,
      host: null,
      last: at,
    };
    c[key] += n;
    c.host ??= host;
    if (at > c.last) c.last = at;
    this.streams.set(k, c);
  }
}

/**
 * Writes an ingest batch: redacted logs and spans, error events into the ingestion buffer (so
 * incidents open through the usual pipeline), and per-stream status for the integrations page.
 */
@Injectable()
export class TelemetryStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryStore.name);
  private readonly ingestIntegration = new Map<string, string>();
  private retentionTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  onModuleInit(): void {
    if (!this.env.INGEST_WORKER_ENABLED) return;
    this.retentionTimer = setInterval(() => void this.applyRetention(), 60 * 60 * 1000);
    this.retentionTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  async write(
    workspaceId: string,
    batch: Batch,
  ): Promise<{ logs: number; spans: number; errors: number }> {
    const tally = new StreamTally();
    const logsWritten = await this.writeLogs(workspaceId, batch, tally);
    await this.writeSpans(workspaceId, batch, tally);
    if (batch.errors.length > 0) await this.bufferErrors(workspaceId, batch, tally);
    for (const m of batch.metrics)
      tally.bump({
        service: m.service,
        environment: m.environment,
        key: 'metrics',
        n: m.count,
        at: new Date(),
      });

    await this.upsertStreams(workspaceId, batch.way, tally.streams);
    return { logs: logsWritten, spans: batch.spans.length, errors: batch.errors.length };
  }

  private async writeLogs(workspaceId: string, batch: Batch, tally: StreamTally): Promise<number> {
    let written = 0;
    for (let i = 0; i < batch.logs.length; i += CHUNK) {
      const rows = batch.logs.slice(i, i + CHUNK).map((l) => {
        tally.bump({
          service: l.service,
          environment: l.environment,
          key: 'logs',
          n: 1,
          at: l.ts,
          host: l.host,
        });
        return {
          workspaceId,
          ts: l.ts,
          service: l.service,
          environment: l.environment,
          level: l.level,
          message: redactText(l.message),
          attributes: redactDeep(l.attributes) as Record<string, unknown>,
          traceId: l.traceId,
          spanId: l.spanId,
          host: l.host,
          way: batch.way,
          dedupKey: l.dedupKey ?? null,
        };
      });
      const res = await this.db
        .insert(logRecords)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: logRecords.id });
      written += res.length;
    }
    return written;
  }

  private async writeSpans(workspaceId: string, batch: Batch, tally: StreamTally): Promise<void> {
    for (let i = 0; i < batch.spans.length; i += CHUNK) {
      const rows = batch.spans.slice(i, i + CHUNK).map((s) => {
        tally.bump({
          service: s.service,
          environment: s.environment,
          key: 'spans',
          n: 1,
          at: s.start,
        });
        return {
          workspaceId,
          traceId: s.traceId,
          spanId: s.spanId,
          parentSpanId: s.parentSpanId,
          service: s.service,
          environment: s.environment,
          name: s.name,
          kind: s.kind,
          startTime: s.start,
          durationMs: s.durationMs.toFixed(3),
          statusCode: s.statusCode,
          statusMessage: s.statusMessage ? redactText(s.statusMessage) : null,
          attributes: redactDeep(s.attributes) as Record<string, unknown>,
          events: redactDeep(s.events) as typeof s.events,
        };
      });
      await this.db.insert(spans).values(rows).onConflictDoNothing();
    }
  }

  /** Errors go through the ingestion buffer so incidents open the usual way. */
  private async bufferErrors(workspaceId: string, batch: Batch, tally: StreamTally): Promise<void> {
    const integrationId = await this.ingestIntegrationId(workspaceId);
    const rows = batch.errors.slice(0, 1000).map((e) => {
      tally.bump({
        service: e.service,
        environment: e.environment,
        key: 'errors',
        n: 1,
        at: e.occurredAt,
      });
      return {
        workspaceId,
        integrationId,
        source: INGEST_ERROR_SOURCE,
        externalEventId: e.eventId ?? errorEventId(e),
        payload: errorPayload(e, batch.way),
      };
    });
    await this.db.insert(inboundEvents).values(rows).onConflictDoNothing();
  }

  private async upsertStreams(workspaceId: string, way: string, streams: Map<string, Counts>) {
    const now = new Date();
    for (const [key, c] of streams) {
      const [serviceName, environment] = key.split('\u0000') as [string, string];
      await this.db
        .insert(ingestStreams)
        .values({
          workspaceId,
          way,
          serviceName,
          environment,
          host: c.host,
          firstReceivedAt: now,
          lastReceivedAt: now,
          logCount: c.logs,
          spanCount: c.spans,
          errorCount: c.errors,
          metricCount: c.metrics,
        })
        .onConflictDoUpdate({
          target: [
            ingestStreams.workspaceId,
            ingestStreams.way,
            ingestStreams.serviceName,
            ingestStreams.environment,
          ],
          set: {
            lastReceivedAt: now,
            host: sql`coalesce(excluded.host, ${ingestStreams.host})`,
            logCount: sql`${ingestStreams.logCount} + excluded.log_count`,
            spanCount: sql`${ingestStreams.spanCount} + excluded.span_count`,
            errorCount: sql`${ingestStreams.errorCount} + excluded.error_count`,
            metricCount: sql`${ingestStreams.metricCount} + excluded.metric_count`,
          },
        });
    }
  }

  /** One hidden integration per workspace owns ingest error events in the buffer. */
  private async ingestIntegrationId(workspaceId: string): Promise<string> {
    const cached = this.ingestIntegration.get(workspaceId);
    if (cached) return cached;
    const [existing] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(eq(integrations.workspaceId, workspaceId), eq(integrations.provider, INGEST_PROVIDER)),
      );
    let id = existing?.id;
    if (!id) {
      const [created] = await this.db
        .insert(integrations)
        .values({
          workspaceId,
          provider: INGEST_PROVIDER,
          name: 'Telemetry ingest',
          status: 'connected',
        })
        .returning({ id: integrations.id });
      id = created!.id;
    }
    this.ingestIntegration.set(workspaceId, id);
    return id;
  }

  async applyRetention(): Promise<void> {
    const cutoff = new Date(Date.now() - this.env.LOG_RETENTION_DAYS * 24 * 3600 * 1000);
    try {
      await this.db.delete(logRecords).where(lt(logRecords.ts, cutoff));
      await this.db.delete(spans).where(lt(spans.startTime, cutoff));
    } catch (err) {
      this.logger.warn(`Retention cleanup failed: ${(err as Error).message}`);
    }
  }
}

/** Without a source id, the same exception at the same moment in the same trace is one event. */
function errorEventId(e: ErrorInput): string {
  if (!e.traceId) return `gen:${randomUUID()}`;
  return `err:${createHash('sha256')
    .update([e.traceId, e.spanId, e.errorType, e.message, e.occurredAt.toISOString()].join('|'))
    .digest('hex')
    .slice(0, 40)}`;
}

function errorPayload(e: ErrorInput, way: string): Record<string, unknown> {
  return {
    way,
    serviceName: e.service,
    environment: e.environment,
    errorType: e.errorType,
    message: redactText(e.message),
    stack: e.stack.map(redactText),
    traceId: e.traceId,
    spanId: e.spanId,
    occurredAt: e.occurredAt.toISOString(),
    route: e.route,
    httpStatus: e.httpStatus,
    operation: e.operation,
    release: e.release,
    attributes: redactDeep(e.attributes),
  };
}
