import type { IngestWay, LogLevel } from '@ape/api-contracts';
import type { SpanEvent } from '../db/schema';

export const DEFAULT_ENVIRONMENT = 'production';
export const DEFAULT_SERVICE = 'unknown-service';

export interface ExceptionInfo {
  type: string;
  message: string;
  stack: string[];
}

export interface LogInput {
  ts: Date;
  service: string;
  environment: string;
  level: LogLevel;
  message: string;
  attributes: Record<string, unknown>;
  traceId: string | null;
  spanId: string | null;
  host: string | null;
  dedupKey?: string | null;
  exception?: ExceptionInfo | null;
}

export interface SpanInput {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  service: string;
  environment: string;
  name: string;
  kind: number;
  start: Date;
  durationMs: number;
  statusCode: number;
  statusMessage: string | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

/** An exception that should open or join an incident. */
export interface ErrorInput {
  service: string;
  environment: string;
  errorType: string;
  message: string;
  stack: string[];
  traceId: string | null;
  spanId: string | null;
  occurredAt: Date;
  route: string | null;
  httpStatus: number | null;
  operation: string | null;
  /** Source-provided id so a retried delivery does not count twice. */
  eventId: string | null;
  release: string | null;
  attributes: Record<string, unknown>;
}

export interface Batch {
  way: IngestWay;
  logs: LogInput[];
  spans: SpanInput[];
  errors: ErrorInput[];
  /** Metric data points per (service, environment); counted, not stored. */
  metrics: { service: string; environment: string; count: number }[];
}

export const emptyBatch = (way: IngestWay): Batch => ({
  way,
  logs: [],
  spans: [],
  errors: [],
  metrics: [],
});

const LEVELS: Record<string, LogLevel> = {
  trace: 'trace',
  verbose: 'trace',
  debug: 'debug',
  dbg: 'debug',
  info: 'info',
  information: 'info',
  informational: 'info',
  notice: 'info',
  log: 'info',
  ok: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  err: 'error',
  severe: 'error',
  fatal: 'fatal',
  critical: 'fatal',
  crit: 'fatal',
  alert: 'fatal',
  emerg: 'fatal',
  emergency: 'fatal',
  panic: 'fatal',
};

/** Maps any level name or number (bunyan/pino numbers, OTel severity numbers) to ours. */
export function toLevel(raw: unknown, fallback: LogLevel = 'info'): LogLevel {
  if (typeof raw === 'number') {
    // pino/bunyan: 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal
    if (raw >= 10 && raw % 10 === 0 && raw <= 60)
      return (['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)[raw / 10 - 1]!;
    return fallback;
  }
  if (typeof raw !== 'string') return fallback;
  return LEVELS[raw.trim().toLowerCase()] ?? fallback;
}

/** OTel SeverityNumber: 1-4 trace, 5-8 debug, 9-12 info, 13-16 warn, 17-20 error, 21-24 fatal. */
export function levelFromSeverityNumber(n: number): LogLevel | null {
  if (!n || n < 1 || n > 24) return null;
  return (['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const)[Math.floor((n - 1) / 4)]!;
}

export const isErrorLevel = (l: LogLevel) => l === 'error' || l === 'fatal';

/** Stack text to at most 20 frames, one per line. */
export function stackLines(stack: unknown): string[] {
  if (Array.isArray(stack)) return stack.map(String).slice(0, 20);
  if (typeof stack !== 'string') return [];
  return stack
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l && !/^\w*(Error|Exception)\b.*:/.test(l) && l !== 'Traceback (most recent call last):',
    )
    .slice(0, 20);
}

/** Bounded copy of attributes: scalars and small nested values only, so rows stay small. */
export function boundAttributes(input: Record<string, unknown>, max = 64): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (Object.keys(out).length >= max) break;
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') out[k.slice(0, 200)] = v.slice(0, 2000);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k.slice(0, 200)] = v;
    else {
      const s = JSON.stringify(v);
      if (s && s.length <= 2000) out[k.slice(0, 200)] = v;
      else if (s) out[k.slice(0, 200)] = `${s.slice(0, 2000)}…`;
    }
  }
  return out;
}

export function parseDate(v: unknown, fallback = new Date()): Date {
  let d: Date;
  if (typeof v === 'number') {
    // seconds, milliseconds, microseconds or nanoseconds since epoch
    const ms = v > 1e17 ? v / 1e6 : v > 1e14 ? v / 1e3 : v > 1e11 ? v : v * 1000;
    d = new Date(ms);
  } else if (typeof v === 'string' && v.trim()) {
    d = /^\d+(\.\d+)?$/.test(v.trim()) ? parseDate(Number(v), fallback) : new Date(v);
  } else return fallback;
  const t = d.getTime();
  // Reject nonsense and clocks far in the future.
  if (Number.isNaN(t) || t < Date.UTC(2000, 0, 1) || t > Date.now() + 24 * 3600 * 1000)
    return fallback;
  return d;
}
