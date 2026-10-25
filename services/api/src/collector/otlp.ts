import type { LogLevel } from '@ape/api-contracts';
import type { SpanEvent } from '../db/schema';
import {
  boundAttributes,
  DEFAULT_ENVIRONMENT,
  DEFAULT_SERVICE,
  emptyBatch,
  isErrorLevel,
  levelFromSeverityNumber,
  parseDate,
  stackLines,
  toLevel,
  type Batch,
  type ErrorInput,
  type LogInput,
} from './types';

/** OTLP/JSON shapes (the protobuf decoder produces the same). Everything is optional on the wire. */
type AnyValue = {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string | number;
  doubleValue?: number;
  arrayValue?: { values?: AnyValue[] };
  kvlistValue?: { values?: KeyValue[] };
  bytesValue?: string;
};
type KeyValue = { key?: string; value?: AnyValue };
type Resource = { attributes?: KeyValue[] };

export function anyValue(v: AnyValue | undefined): unknown {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue;
  if (v.intValue !== undefined) return Number(v.intValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(anyValue);
  if (v.kvlistValue) return attributesOf(v.kvlistValue.values);
  if (v.bytesValue !== undefined) return v.bytesValue;
  return null;
}

export function attributesOf(kvs: KeyValue[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const kv of kvs ?? []) if (kv.key) out[kv.key] = anyValue(kv.value);
  return out;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null;

function resourceInfo(resource: Resource | undefined) {
  const a = attributesOf(resource?.attributes);
  return {
    service: (str(a['service.name']) ?? DEFAULT_SERVICE).slice(0, 100),
    environment: (
      str(a['deployment.environment.name']) ??
      str(a['deployment.environment']) ??
      DEFAULT_ENVIRONMENT
    ).slice(0, 40),
    host: str(a['host.name']) ?? str(a['k8s.pod.name']) ?? null,
    release: str(a['service.version']),
    attributes: a,
  };
}

/** Hex ids; JSON encoders sometimes send base64. All-zero ids mean "unset". */
function id(v: unknown, bytes: number): string | null {
  if (typeof v !== 'string' || !v) return null;
  let h = v.toLowerCase();
  if (!/^[0-9a-f]+$/.test(h)) h = Buffer.from(v, 'base64').toString('hex');
  if (h.length !== bytes * 2 || /^0+$/.test(h)) return null;
  return h;
}

const nanosToDate = (v: unknown, fallback?: Date) =>
  parseDate(typeof v === 'string' || typeof v === 'number' ? Number(v) / 1e6 : undefined, fallback);

/** Exact from nanoseconds when both are present (Date keeps only milliseconds). */
function durationMs(startNs: unknown, endNs: unknown, start: Date, end: Date): number {
  try {
    if (
      (typeof startNs === 'string' || typeof startNs === 'number') &&
      (typeof endNs === 'string' || typeof endNs === 'number')
    ) {
      const d = BigInt(endNs) - BigInt(startNs);
      if (d >= 0n) return Number(d / 1000n) / 1000;
    }
  } catch {
    // fall through to millisecond precision
  }
  return Math.max(0, end.getTime() - start.getTime());
}

const SPAN_KINDS: Record<string, number> = {
  SPAN_KIND_UNSPECIFIED: 0,
  SPAN_KIND_INTERNAL: 1,
  SPAN_KIND_SERVER: 2,
  SPAN_KIND_CLIENT: 3,
  SPAN_KIND_PRODUCER: 4,
  SPAN_KIND_CONSUMER: 5,
};
const STATUS_CODES: Record<string, number> = {
  STATUS_CODE_UNSET: 0,
  STATUS_CODE_OK: 1,
  STATUS_CODE_ERROR: 2,
};
const enumOf = (v: unknown, names: Record<string, number>) =>
  typeof v === 'number' ? v : typeof v === 'string' ? (names[v] ?? 0) : 0;

function exceptionFrom(a: Record<string, unknown>) {
  const type = str(a['exception.type']);
  const message = str(a['exception.message']);
  if (!type && !message) return null;
  return {
    type: (type ?? 'Error').slice(0, 200),
    message: (message ?? '').slice(0, 2000),
    stack: stackLines(a['exception.stacktrace']),
  };
}

interface OtlpSpan {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  kind?: number | string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: KeyValue[];
  events?: { timeUnixNano?: string | number; name?: string; attributes?: KeyValue[] }[];
  status?: { code?: number | string; message?: string };
}

interface TracesRequest {
  resourceSpans?: {
    resource?: Resource;
    scopeSpans?: { spans?: OtlpSpan[] }[];
  }[];
}

type ResourceInfo = ReturnType<typeof resourceInfo>;

/** The stored span and, for an error span with a recorded exception, the error occurrence. */
function spanEntries(
  s: OtlpSpan,
  res: ResourceInfo,
): { span: Batch['spans'][number]; error: ErrorInput | null } | null {
  const traceId = id(s.traceId, 16);
  const spanId = id(s.spanId, 8);
  if (!traceId || !spanId) return null;
  const start = nanosToDate(s.startTimeUnixNano);
  const end = nanosToDate(s.endTimeUnixNano, start);
  const attributes = attributesOf(s.attributes);
  const events: SpanEvent[] = (s.events ?? []).slice(0, 32).map((e) => ({
    name: e.name ?? '',
    time: nanosToDate(e.timeUnixNano, start).toISOString(),
    attributes: boundAttributes(attributesOf(e.attributes), 16),
  }));
  const statusCode = enumOf(s.status?.code, STATUS_CODES);
  const span = {
    traceId,
    spanId,
    parentSpanId: id(s.parentSpanId, 8),
    service: res.service,
    environment: res.environment,
    name: (s.name ?? '').slice(0, 300),
    kind: enumOf(s.kind, SPAN_KINDS),
    start,
    durationMs: durationMs(s.startTimeUnixNano, s.endTimeUnixNano, start, end),
    statusCode,
    statusMessage: s.status?.message?.slice(0, 1000) || null,
    attributes: boundAttributes(attributes),
    events,
  };

  // An error span with a recorded exception is an error occurrence.
  const exEvent = events.find((e) => e.name === 'exception');
  const ex = exEvent ? exceptionFrom(exEvent.attributes) : null;
  if (statusCode !== 2 || !ex) return { span, error: null };
  return {
    span,
    error: {
      service: res.service,
      environment: res.environment,
      errorType: ex.type,
      message: ex.message,
      stack: ex.stack,
      traceId,
      spanId,
      occurredAt: start,
      route: str(attributes['http.route']),
      httpStatus:
        Number(attributes['http.response.status_code'] ?? attributes['http.status_code']) || null,
      operation: s.name ?? null,
      eventId: `span:${traceId}:${spanId}`,
      release: res.release,
      attributes: {},
    },
  };
}

export function tracesToBatch(req: TracesRequest, way: Batch['way'] = 'otlp'): Batch {
  const batch = emptyBatch(way);
  for (const rs of req.resourceSpans ?? []) {
    const res = resourceInfo(rs.resource);
    for (const ss of rs.scopeSpans ?? []) {
      for (const s of ss.spans ?? []) {
        const entries = spanEntries(s, res);
        if (!entries) continue;
        batch.spans.push(entries.span);
        if (entries.error) batch.errors.push(entries.error);
      }
    }
  }
  return withoutClientErrors(batch);
}

/**
 * An exception is often recorded on an inner span while the HTTP status lives on the trace's
 * server span. Borrow that status, then drop errors that ended as a 4xx response: a declined card
 * or a validation error is the app working as designed, not an incident. The Jaeger poller applies
 * the same rule. The spans themselves are still stored.
 * shortcut: only looks at server spans in the same batch; a server span exported in a later
 * batch is missed, so a rare 4xx exception can still open an incident.
 */
function withoutClientErrors(batch: Batch): Batch {
  const serverStatus = new Map<string, number>();
  for (const sp of batch.spans) {
    const status = Number(
      sp.attributes['http.response.status_code'] ?? sp.attributes['http.status_code'],
    );
    if (sp.kind === SPAN_KINDS.SPAN_KIND_SERVER && status) serverStatus.set(sp.traceId, status);
  }
  batch.errors = batch.errors.filter((e) => {
    const status = e.httpStatus ?? (e.traceId ? serverStatus.get(e.traceId) : undefined) ?? null;
    e.httpStatus = status;
    return status === null || status >= 500;
  });
  return batch;
}

interface OtlpLogRecord {
  timeUnixNano?: string | number;
  observedTimeUnixNano?: string | number;
  severityNumber?: number | string;
  severityText?: string;
  body?: AnyValue;
  attributes?: KeyValue[];
  traceId?: string;
  spanId?: string;
}

interface LogsRequest {
  resourceLogs?: {
    resource?: Resource;
    scopeLogs?: { logRecords?: OtlpLogRecord[] }[];
  }[];
}

function logLevelOf(r: OtlpLogRecord): LogLevel {
  const sevNum =
    typeof r.severityNumber === 'string'
      ? parseInt(r.severityNumber.replace(/\D/g, ''), 10)
      : r.severityNumber;
  return levelFromSeverityNumber(Number(sevNum)) ?? toLevel(r.severityText, 'info');
}

function logMessageOf(body: unknown): string {
  if (typeof body === 'string') return body;
  return body == null ? '' : JSON.stringify(body);
}

function logEntries(
  r: OtlpLogRecord,
  res: ResourceInfo,
): { log: LogInput; error: ErrorInput | null } {
  const attributes = attributesOf(r.attributes);
  const level = logLevelOf(r);
  const ts =
    r.timeUnixNano && String(r.timeUnixNano) !== '0'
      ? nanosToDate(r.timeUnixNano)
      : nanosToDate(r.observedTimeUnixNano);
  const traceId = id(r.traceId, 16);
  const spanId = id(r.spanId, 8);
  const ex = exceptionFrom(attributes);
  const log: LogInput = {
    ts,
    service: res.service,
    environment: res.environment,
    level,
    message: logMessageOf(anyValue(r.body)).slice(0, 32_000),
    attributes: boundAttributes(attributes),
    traceId,
    spanId,
    host: res.host,
    exception: ex,
  };
  const error =
    ex && isErrorLevel(level) ? errorFromLog({ res, ex, ts, traceId, spanId, attributes }) : null;
  return { log, error };
}

export function logsToBatch(req: LogsRequest, way: Batch['way'] = 'otlp'): Batch {
  const batch = emptyBatch(way);
  for (const rl of req.resourceLogs ?? []) {
    const res = resourceInfo(rl.resource);
    for (const sl of rl.scopeLogs ?? []) {
      for (const r of sl.logRecords ?? []) {
        const { log, error } = logEntries(r, res);
        batch.logs.push(log);
        if (error) batch.errors.push(error);
      }
    }
  }
  return batch;
}

interface ErrorFromLogInput {
  res: ResourceInfo;
  ex: { type: string; message: string; stack: string[] };
  ts: Date;
  traceId: string | null;
  spanId: string | null;
  attributes: Record<string, unknown>;
}

function errorFromLog(input: ErrorFromLogInput): ErrorInput {
  const { res, ex, ts, traceId, spanId, attributes } = input;
  return {
    service: res.service,
    environment: res.environment,
    errorType: ex.type,
    message: ex.message,
    stack: ex.stack,
    traceId,
    spanId,
    occurredAt: ts,
    route: str(attributes['http.route']),
    httpStatus: null,
    operation: null,
    eventId: null,
    release: res.release,
    attributes: {},
  };
}

interface MetricsRequest {
  resourceMetrics?: { resource?: Resource; scopeMetrics?: { metrics?: unknown[] }[] }[];
}

export function metricsToBatch(req: MetricsRequest): Batch {
  const batch = emptyBatch('otlp');
  for (const rm of req.resourceMetrics ?? []) {
    const res = resourceInfo(rm.resource);
    const count = (rm.scopeMetrics ?? []).reduce((n, sm) => n + (sm.metrics?.length ?? 0), 0);
    if (count > 0)
      batch.metrics.push({ service: res.service, environment: res.environment, count });
  }
  return batch;
}
