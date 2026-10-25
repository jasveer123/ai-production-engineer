import { stackLines, type ExceptionInfo } from './types';

export function safeJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return undefined;
  }
}

/** Reads `a.b.c` as a flat key first (`{"a.b.c": 1}`), then as a nested path. */
export function pick(rec: Record<string, unknown>, path: string): unknown {
  if (path in rec) return rec[path];
  let cur: unknown = rec;
  for (const part of path.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function first(rec: Record<string, unknown>, paths: string[]): unknown {
  for (const p of paths) {
    const v = pick(rec, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export const text = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;

export const MESSAGE_KEYS = ['message', 'msg', 'log', 'MESSAGE', 'text', 'body', 'event'];
export const LEVEL_KEYS = [
  'level',
  'severity',
  'lvl',
  'log.level',
  'levelname',
  'loglevel',
  'status',
  'severity_text',
];
export const TIME_KEYS = [
  'timestamp',
  'time',
  'ts',
  '@timestamp',
  'date',
  'datetime',
  'dt',
  'eventTime',
];
// Not `source_type` or `logger_name`: Vector and Python set those on every record, and they
// name the collector or a module, not the service.
export const SERVICE_KEYS = [
  'service',
  'service.name',
  'service_name',
  'app',
  'application',
  'kubernetes.container_name',
  'kubernetes.labels.app',
  'container_name',
];
export const ENV_KEYS = [
  'environment',
  'env',
  'deployment.environment',
  'deployment.environment.name',
];
export const HOST_KEYS = ['host', 'hostname', 'host.name', 'kubernetes.pod_name', 'pod'];
export const TRACE_KEYS = ['trace_id', 'traceId', 'trace.id', 'dd.trace_id', 'otelTraceID'];
export const SPAN_KEYS = ['span_id', 'spanId', 'span.id', 'dd.span_id', 'otelSpanID'];
export const USED = new Set([
  ...MESSAGE_KEYS,
  ...LEVEL_KEYS,
  ...TIME_KEYS,
  ...SERVICE_KEYS.slice(0, 5),
  'source_type',
  ...ENV_KEYS,
  'host',
  'hostname',
  ...TRACE_KEYS,
  ...SPAN_KEYS,
  'exception',
  'error',
  'stack',
  'stacktrace',
]);

export function hexId(v: unknown, len: number): string | null {
  const s = text(v)?.toLowerCase().replace(/-/g, '');
  return s && new RegExp(`^[0-9a-f]{${len}}$`).test(s) && !/^0+$/.test(s) ? s : null;
}

const clip = (type: string | null, message: string | null, stack: unknown): ExceptionInfo => ({
  type: (type ?? 'Error').slice(0, 200),
  message: (message ?? '').slice(0, 2000),
  stack: stackLines(stack),
});

/** `exception{type,message,stacktrace}` or ECS `error{...}` as a nested object. */
function exceptionFromObject(rec: Record<string, unknown>): ExceptionInfo | null {
  const ex = rec.exception ?? rec.error ?? rec.err;
  if (!ex || typeof ex !== 'object' || Array.isArray(ex)) return null;
  const e = ex as Record<string, unknown>;
  const type = text(e.type ?? e.name ?? e.kind ?? e.class);
  const message = text(e.message ?? e.value ?? e.msg);
  if (!type && !message) return null;
  return clip(type, message, e.stacktrace ?? e.stack_trace ?? e.stack);
}

/** Flat keys such as `exception.type` or `error.message`, or a bare Node-style stack string. */
function exceptionFromFlatKeys(rec: Record<string, unknown>): ExceptionInfo | null {
  const type = text(first(rec, ['exception.type', 'error.type', 'error.kind', 'exc_type']));
  const message = text(first(rec, ['exception.message', 'error.message', 'exc_message']));
  const stack = first(rec, [
    'exception.stacktrace',
    'error.stack_trace',
    'error.stack',
    'stack',
    'stacktrace',
    'exc_info',
  ]);
  if (type || (message && stack)) return clip(type, message, stack);
  // A Node-style stack string alone: "TypeError: x\n    at ...".
  const raw = text(stack);
  const m = raw ? /^([A-Za-z_$][\w$.]*(?:Error|Exception))(?::\s*(.*))?$/m.exec(raw) : null;
  return m ? { type: m[1]!, message: (m[2] ?? '').slice(0, 2000), stack: stackLines(raw) } : null;
}

export function exceptionOf(rec: Record<string, unknown>): ExceptionInfo | null {
  return exceptionFromObject(rec) ?? exceptionFromFlatKeys(rec);
}
