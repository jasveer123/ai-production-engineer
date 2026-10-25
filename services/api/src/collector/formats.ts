import { z } from 'zod';
import type { LogLevel } from '@ape/api-contracts';
import {
  exceptionOf,
  first,
  hexId,
  safeJson,
  text,
  ENV_KEYS,
  HOST_KEYS,
  LEVEL_KEYS,
  MESSAGE_KEYS,
  SERVICE_KEYS,
  SPAN_KEYS,
  TIME_KEYS,
  TRACE_KEYS,
  USED,
} from './record-fields';
import {
  boundAttributes,
  DEFAULT_ENVIRONMENT,
  DEFAULT_SERVICE,
  emptyBatch,
  isErrorLevel,
  parseDate,
  stackLines,
  toLevel,
  type Batch,
  type ErrorInput,
  type ExceptionInfo,
  type LogInput,
} from './types';

export class BadPayload extends Error {}

const MAX_RECORDS = 10_000;

/** Reads a JSON object, a JSON array, or newline-delimited JSON. */
export function parseJsonRecords(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let values: unknown[];
  if (trimmed.startsWith('[')) {
    const parsed = safeJson(trimmed);
    if (!Array.isArray(parsed)) throw new BadPayload('Body is not valid JSON');
    values = parsed;
  } else {
    const whole = safeJson(trimmed);
    if (whole !== undefined) values = [whole];
    else {
      values = trimmed.split('\n').flatMap((line) => {
        if (!line.trim()) return [];
        const v = safeJson(line);
        if (v === undefined) throw new BadPayload('Body is neither JSON nor NDJSON');
        return [v];
      });
    }
  }
  if (values.length > MAX_RECORDS)
    throw new BadPayload(`At most ${MAX_RECORDS} records per request`);
  return values.map((v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : { message: typeof v === 'string' ? v : JSON.stringify(v) },
  );
}

export interface Defaults {
  service?: string | null;
  environment?: string | null;
}

/** Apps that log JSON to stdout: lift the fields of the inner object over the outer record. */
function liftInnerJson(rec: Record<string, unknown>): {
  message: string;
  merged: Record<string, unknown>;
} {
  const message = text(first(rec, MESSAGE_KEYS)) ?? '';
  if (!message.startsWith('{') || !message.endsWith('}')) return { message, merged: rec };
  const parsed = safeJson(message);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return { message, merged: rec };
  const inner = parsed as Record<string, unknown>;
  return {
    message: text(first(inner, MESSAGE_KEYS)) ?? message,
    merged: { ...rec, ...inner },
  };
}

function extraAttributes(
  merged: Record<string, unknown>,
  exception: ExceptionInfo | null,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) if (!USED.has(k)) attributes[k] = v;
  if (exception) {
    attributes['exception.type'] = exception.type;
    attributes['exception.message'] = exception.message;
  }
  return attributes;
}

/** One generic JSON record (HTTP API, Vector, Fluent Bit, SDK logs) to a log line. */
export function recordToLog(rec: Record<string, unknown>, defaults: Defaults = {}): LogInput {
  const { message, merged } = liftInnerJson(rec);
  const exception = exceptionOf(merged);
  const service = text(first(merged, SERVICE_KEYS)) ?? defaults.service ?? DEFAULT_SERVICE;
  const environment = text(first(merged, ENV_KEYS)) ?? defaults.environment ?? DEFAULT_ENVIRONMENT;
  return {
    ts: parseDate(first(merged, TIME_KEYS)),
    service: service.slice(0, 100),
    environment: environment.slice(0, 40),
    level: toLevel(first(merged, LEVEL_KEYS), exception ? 'error' : 'info'),
    message: (message || (exception ? `${exception.type}: ${exception.message}` : '')).slice(
      0,
      32_000,
    ),
    attributes: boundAttributes(extraAttributes(merged, exception)),
    traceId: hexId(first(merged, TRACE_KEYS), 32),
    spanId: hexId(first(merged, SPAN_KEYS), 16),
    host: text(first(merged, HOST_KEYS))?.slice(0, 200) ?? null,
    exception,
  };
}

export function errorFromLog(log: LogInput, eventId: string | null = null): ErrorInput | null {
  if (!log.exception || !isErrorLevel(log.level)) return null;
  const a = log.attributes;
  return {
    service: log.service,
    environment: log.environment,
    errorType: log.exception.type,
    message: log.exception.message,
    stack: log.exception.stack,
    traceId: log.traceId,
    spanId: log.spanId,
    occurredAt: log.ts,
    route: text(a['http.route'] ?? a.route ?? a.path)?.slice(0, 300) ?? null,
    httpStatus: Number(a.statusCode ?? a.status_code ?? a['http.status_code']) || null,
    operation: null,
    eventId,
    release: text(a.release ?? a['service.version']),
    attributes: {},
  };
}

/** Plain JSON logs: Way 3 (HTTP API) and Way 4 (Vector, Fluent Bit). */
export function jsonLogsToBatch(body: string, way: Batch['way'], defaults: Defaults = {}): Batch {
  const batch = emptyBatch(way);
  for (const rec of parseJsonRecords(body)) {
    const log = recordToLog(rec, defaults);
    batch.logs.push(log);
    const err = errorFromLog(log);
    if (err) batch.errors.push(err);
  }
  return batch;
}

// ---------- SDK error events (/v1/errors) ----------

export const sdkErrorSchema = z.object({
  event_id: z.string().max(100).nullish(),
  timestamp: z.union([z.string(), z.number()]).nullish(),
  service: z.string().max(100).nullish(),
  environment: z.string().max(40).nullish(),
  release: z.string().max(100).nullish(),
  level: z.string().max(20).nullish(),
  type: z.string().min(1).max(200),
  message: z.string().max(4000).nullish(),
  stack: z.union([z.string().max(50_000), z.array(z.string().max(2000)).max(100)]).nullish(),
  trace_id: z.string().max(64).nullish(),
  span_id: z.string().max(32).nullish(),
  route: z.string().max(300).nullish(),
  method: z.string().max(10).nullish(),
  status_code: z.number().int().nullish(),
  host: z.string().max(200).nullish(),
  runtime: z.string().max(100).nullish(),
  handled: z.boolean().nullish(),
  context: z.record(z.unknown()).nullish(),
});

type SdkError = z.infer<typeof sdkErrorSchema>;

function sdkErrorEntries(e: SdkError, defaults: Defaults): { error: ErrorInput; log: LogInput } {
  const occurredAt = parseDate(e.timestamp);
  const service = e.service ?? defaults.service ?? DEFAULT_SERVICE;
  const environment = e.environment ?? defaults.environment ?? DEFAULT_ENVIRONMENT;
  const stack = stackLines(e.stack);
  const attributes = boundAttributes({
    ...(e.context ?? {}),
    runtime: e.runtime,
    handled: e.handled,
    method: e.method,
  });
  const traceId = hexId(e.trace_id, 32);
  const spanId = hexId(e.span_id, 16);
  const key = e.event_id ? `sdk:${e.event_id}` : null;
  return {
    error: {
      service,
      environment,
      errorType: e.type,
      message: e.message ?? '',
      stack,
      traceId,
      spanId,
      occurredAt,
      route: e.route ?? null,
      httpStatus: e.status_code ?? null,
      operation: e.method && e.route ? `${e.method} ${e.route}` : null,
      eventId: key,
      release: e.release ?? null,
      attributes,
    },
    // Also kept searchable on the Logs page.
    log: {
      ts: occurredAt,
      service,
      environment,
      level: toLevel(e.level, 'error'),
      message: `${e.type}: ${e.message ?? ''}`.slice(0, 32_000),
      attributes: {
        ...attributes,
        'exception.type': e.type,
        'exception.stacktrace': stack.join('\n'),
      },
      traceId,
      spanId,
      host: e.host ?? null,
      dedupKey: key,
    },
  };
}

export function sdkErrorsToBatch(body: string, defaults: Defaults = {}): Batch {
  const batch = emptyBatch('package');
  for (const rec of parseJsonRecords(body)) {
    const p = sdkErrorSchema.safeParse(rec);
    if (!p.success) throw new BadPayload(p.error.issues[0]?.message ?? 'Invalid error event');
    const { error, log } = sdkErrorEntries(p.data, defaults);
    batch.errors.push(error);
    batch.logs.push(log);
  }
  return batch;
}

// ---------- Vercel log drains (Way 5) ----------

function vercelFallbackLevel(rec: Record<string, unknown>, statusCode: number | null): LogLevel {
  // statusCode -1 means the function crashed without a response.
  if (statusCode === -1 || rec.type === 'fatal') return 'fatal';
  return rec.type === 'stderr' ? 'error' : 'info';
}

function vercelRecordToLog(rec: Record<string, unknown>, defaults: Defaults): LogInput {
  const proxy = (rec.proxy ?? {}) as Record<string, unknown>;
  const statusCode = Number(rec.statusCode ?? proxy.statusCode) || null;
  const log = recordToLog(
    {
      ...rec,
      level: rec.level ?? vercelFallbackLevel(rec, statusCode),
      service: rec.projectName ?? rec.projectId ?? defaults.service,
      environment: rec.customEnvironment ?? rec.environment ?? defaults.environment,
      path: rec.path ?? proxy.path,
      statusCode,
    },
    defaults,
  );
  log.dedupKey = typeof rec.id === 'string' ? `vercel:${rec.id}` : null;
  return log;
}

export function vercelToBatch(body: string, defaults: Defaults = {}): Batch {
  const batch = emptyBatch('drain');
  for (const rec of parseJsonRecords(body)) {
    const log = vercelRecordToLog(rec, defaults);
    batch.logs.push(log);
    const err = errorFromLog(log, log.dedupKey);
    if (err) batch.errors.push(err);
  }
  return batch;
}
