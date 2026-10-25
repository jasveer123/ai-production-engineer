import { z } from 'zod';
import type { LogLevel } from '@ape/api-contracts';
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

function safeJson(s: string): unknown {
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

function first(rec: Record<string, unknown>, paths: string[]): unknown {
  for (const p of paths) {
    const v = pick(rec, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

const text = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;

const MESSAGE_KEYS = ['message', 'msg', 'log', 'MESSAGE', 'text', 'body', 'event'];
const LEVEL_KEYS = [
  'level',
  'severity',
  'lvl',
  'log.level',
  'levelname',
  'loglevel',
  'status',
  'severity_text',
];
const TIME_KEYS = ['timestamp', 'time', 'ts', '@timestamp', 'date', 'datetime', 'dt', 'eventTime'];
// Not `source_type` or `logger_name`: Vector and Python set those on every record, and they
// name the collector or a module, not the service.
const SERVICE_KEYS = [
  'service',
  'service.name',
  'service_name',
  'app',
  'application',
  'kubernetes.container_name',
  'kubernetes.labels.app',
  'container_name',
];
const ENV_KEYS = ['environment', 'env', 'deployment.environment', 'deployment.environment.name'];
const HOST_KEYS = ['host', 'hostname', 'host.name', 'kubernetes.pod_name', 'pod'];
const TRACE_KEYS = ['trace_id', 'traceId', 'trace.id', 'dd.trace_id', 'otelTraceID'];
const SPAN_KEYS = ['span_id', 'spanId', 'span.id', 'dd.span_id', 'otelSpanID'];
const USED = new Set([
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

function hexId(v: unknown, len: number): string | null {
  const s = text(v)?.toLowerCase().replace(/-/g, '');
  return s && new RegExp(`^[0-9a-f]{${len}}$`).test(s) && !/^0+$/.test(s) ? s : null;
}

/** Exception from common shapes: `exception{type,message,stacktrace}`, ECS `error.*`, `stack`. */
function exceptionOf(rec: Record<string, unknown>): ExceptionInfo | null {
  const ex = rec.exception ?? rec.error ?? rec.err;
  if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
    const e = ex as Record<string, unknown>;
    const type = text(e.type ?? e.name ?? e.kind ?? e.class);
    const message = text(e.message ?? e.value ?? e.msg);
    const stack = e.stacktrace ?? e.stack_trace ?? e.stack;
    if (type || message) {
      return {
        type: (type ?? 'Error').slice(0, 200),
        message: (message ?? '').slice(0, 2000),
        stack: stackLines(stack),
      };
    }
  }
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
  if (type || (message && stack)) {
    return {
      type: (type ?? 'Error').slice(0, 200),
      message: (message ?? '').slice(0, 2000),
      stack: stackLines(stack),
    };
  }
  // A Node-style stack string alone: "TypeError: x\n    at ...".
  const raw = text(stack);
  const m = raw ? /^([A-Za-z_$][\w$.]*(?:Error|Exception))(?::\s*(.*))?$/m.exec(raw) : null;
  if (m) return { type: m[1]!, message: (m[2] ?? '').slice(0, 2000), stack: stackLines(raw) };
  return null;
}

export interface Defaults {
  service?: string | null;
  environment?: string | null;
}

/** One generic JSON record (HTTP API, Vector, Fluent Bit, SDK logs) to a log line. */
export function recordToLog(rec: Record<string, unknown>, defaults: Defaults = {}): LogInput {
  let message = text(first(rec, MESSAGE_KEYS)) ?? '';
  let inner: Record<string, unknown> = {};
  // Apps that log JSON to stdout: lift the fields of the inner object.
  if (message.startsWith('{') && message.endsWith('}')) {
    const parsed = safeJson(message);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      inner = parsed as Record<string, unknown>;
      message = text(first(inner, MESSAGE_KEYS)) ?? message;
    }
  }
  const merged = { ...rec, ...inner };
  const exception = exceptionOf(merged);
  const level = toLevel(first(merged, LEVEL_KEYS), exception ? 'error' : 'info');
  const attributes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(merged)) if (!USED.has(k)) attributes[k] = v;
  if (exception) {
    attributes['exception.type'] = exception.type;
    attributes['exception.message'] = exception.message;
  }

  return {
    ts: parseDate(first(merged, TIME_KEYS)),
    service: (text(first(merged, SERVICE_KEYS)) ?? defaults.service ?? DEFAULT_SERVICE).slice(
      0,
      100,
    ),
    environment: (
      text(first(merged, ENV_KEYS)) ??
      defaults.environment ??
      DEFAULT_ENVIRONMENT
    ).slice(0, 40),
    level,
    message: (message || (exception ? `${exception.type}: ${exception.message}` : '')).slice(
      0,
      32_000,
    ),
    attributes: boundAttributes(attributes),
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

export function sdkErrorsToBatch(body: string, defaults: Defaults = {}): Batch {
  const batch = emptyBatch('package');
  for (const rec of parseJsonRecords(body)) {
    const p = sdkErrorSchema.safeParse(rec);
    if (!p.success) throw new BadPayload(p.error.issues[0]?.message ?? 'Invalid error event');
    const e = p.data;
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
    batch.errors.push({
      service,
      environment,
      errorType: e.type,
      message: e.message ?? '',
      stack,
      traceId: hexId(e.trace_id, 32),
      spanId: hexId(e.span_id, 16),
      occurredAt,
      route: e.route ?? null,
      httpStatus: e.status_code ?? null,
      operation: e.method && e.route ? `${e.method} ${e.route}` : null,
      eventId: e.event_id ? `sdk:${e.event_id}` : null,
      release: e.release ?? null,
      attributes,
    });
    // Also keep it searchable on the Logs page.
    batch.logs.push({
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
      traceId: hexId(e.trace_id, 32),
      spanId: hexId(e.span_id, 16),
      host: e.host ?? null,
      dedupKey: e.event_id ? `sdk:${e.event_id}` : null,
    });
  }
  return batch;
}

// ---------- Vercel log drains (Way 5) ----------

export function vercelToBatch(body: string, defaults: Defaults = {}): Batch {
  const batch = emptyBatch('drain');
  for (const rec of parseJsonRecords(body)) {
    const proxy = (rec.proxy ?? {}) as Record<string, unknown>;
    const statusCode = Number(rec.statusCode ?? proxy.statusCode) || null;
    // statusCode -1 means the function crashed without a response.
    const fallback: LogLevel =
      statusCode === -1 || rec.type === 'fatal'
        ? 'fatal'
        : rec.type === 'stderr'
          ? 'error'
          : 'info';
    const log = recordToLog(
      {
        ...rec,
        level: rec.level ?? fallback,
        service: rec.projectName ?? rec.projectId ?? defaults.service,
        environment: rec.customEnvironment ?? rec.environment ?? defaults.environment,
        path: rec.path ?? proxy.path,
        statusCode,
      },
      defaults,
    );
    log.dedupKey = typeof rec.id === 'string' ? `vercel:${rec.id}` : null;
    batch.logs.push(log);
    const err = errorFromLog(log, log.dedupKey);
    if (err) batch.errors.push(err);
  }
  return batch;
}

// ---------- Syslog (Heroku logplex, Render, rsyslog) ----------

export interface SyslogMessage {
  severity: number;
  ts: Date;
  hostname: string | null;
  appName: string | null;
  procId: string | null;
  structuredData: { id: string; params: Record<string, string> }[];
  message: string;
}

const SEVERITY_LEVEL: LogLevel[] = [
  'fatal',
  'fatal',
  'fatal',
  'error',
  'warn',
  'info',
  'info',
  'debug',
];
const nil = (v: string | undefined) => (v && v !== '-' ? v : null);

function parseStructuredData(s: string): { sd: SyslogMessage['structuredData']; rest: string } {
  const sd: SyslogMessage['structuredData'] = [];
  let i = 0;
  while (s[i] === '[') {
    const close = findClose(s, i);
    if (close < 0) break;
    const body = s.slice(i + 1, close);
    const sp = body.indexOf(' ');
    const id = sp < 0 ? body : body.slice(0, sp);
    const params: Record<string, string> = {};
    const re = /([^\s=]+)="((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sp < 0 ? '' : body.slice(sp + 1))))
      params[m[1]!] = m[2]!.replace(/\\(["\\\]])/g, '$1');
    sd.push({ id, params });
    i = close + 1;
  }
  return { sd, rest: s.slice(i).replace(/^ /, '') };
}

function findClose(s: string, start: number): number {
  let inQuote = false;
  for (let i = start + 1; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === '"') inQuote = !inQuote;
    else if (c === ']' && !inQuote) return i;
  }
  return -1;
}

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** RFC 5424 (with or without STRUCTURED-DATA, as Heroku sends it) and RFC 3164 fallback. */
export function parseSyslog(line: string): SyslogMessage | null {
  const pri = /^<(\d{1,3})>/.exec(line);
  if (!pri) return null;
  const severity = Number(pri[1]) & 7;
  const rest = line.slice(pri[0].length);

  const v5424 = /^(\d{1,2}) (\S+) (\S+) (\S+) (\S+) (\S+) ?(.*)$/s.exec(rest);
  if (v5424) {
    // VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID, then [SD] or "-" (Heroku omits SD).
    const [, , ts, host, app, proc, , afterMsgId = ''] = v5424;
    let sd: SyslogMessage['structuredData'] = [];
    let message = afterMsgId;
    if (afterMsgId.startsWith('[')) ({ sd, rest: message } = parseStructuredData(afterMsgId));
    else if (afterMsgId.startsWith('- ') || afterMsgId === '-') message = afterMsgId.slice(2);
    return {
      severity,
      ts: parseDate(nil(ts) ?? undefined),
      hostname: nil(host),
      appName: nil(app),
      procId: nil(proc),
      structuredData: sd,
      message: message.replace(/^\uFEFF/, '').trimEnd(),
    };
  }

  // RFC 3164: "Oct 11 22:14:15 host tag[pid]: message"
  const v3164 =
    /^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\S+) ([^:[\s]+)(?:\[([^\]]+)\])?: ?(.*)$/s.exec(
      rest,
    );
  if (v3164) {
    const [, mon, day, time, host, tag, pid, msg] = v3164;
    const now = new Date();
    const d = new Date(
      `${now.getUTCFullYear()}-${String(MONTHS.indexOf(mon!) + 1).padStart(2, '0')}-${day!.padStart(2, '0')}T${time}Z`,
    );
    return {
      severity,
      ts: parseDate(d.toISOString()),
      hostname: host!,
      appName: tag!,
      procId: pid ?? null,
      structuredData: [],
      message: msg!.trimEnd(),
    };
  }
  return {
    severity,
    ts: new Date(),
    hostname: null,
    appName: null,
    procId: null,
    structuredData: [],
    message: rest,
  };
}

/** The ingest token inside a syslog message: `[TOKEN@41058]`, `[x token="..."]` or `token=... `. */
export function syslogToken(m: SyslogMessage): string | null {
  for (const el of m.structuredData) {
    if (el.id.startsWith('ape_live_')) return el.id.split('@')[0]!;
    const t = el.params.token ?? el.params.apiKey ?? el.params.api_key;
    if (t?.startsWith('ape_live_')) return t;
  }
  const inMsg = /^(?:token=)?(ape_live_[A-Za-z0-9]+)\s/.exec(m.message);
  return inMsg ? inMsg[1]! : null;
}

export function syslogToLog(m: SyslogMessage, defaults: Defaults = {}): LogInput {
  // The message may itself be JSON (structured app logs); let the generic mapper read it.
  const msg = m.message.replace(/^(?:token=)?ape_live_[A-Za-z0-9]+\s/, '');
  const base = recordToLog(
    { message: msg, level: SEVERITY_LEVEL[m.severity], timestamp: m.ts.toISOString() },
    {
      service: defaults.service ?? m.appName,
      environment: defaults.environment,
    },
  );
  const attributes: Record<string, unknown> = { ...base.attributes };
  if (m.procId) attributes['process.id'] = m.procId;
  for (const el of m.structuredData)
    for (const [k, v] of Object.entries(el.params)) if (k !== 'token') attributes[`sd.${k}`] = v;
  return { ...base, host: base.host ?? m.hostname, attributes: boundAttributes(attributes) };
}

/** Heroku `application/logplex-1`: RFC 6587 octet-counted frames of syslog lines. */
export function parseOctetFrames(body: string): string[] {
  const buf = Buffer.from(body, 'utf8');
  const out: string[] = [];
  let i = 0;
  while (i < buf.length) {
    while (i < buf.length && (buf[i] === 0x0a || buf[i] === 0x0d || buf[i] === 0x20)) i++;
    if (i >= buf.length) break;
    let j = i;
    while (j < buf.length && buf[j]! >= 0x30 && buf[j]! <= 0x39) j++;
    if (j === i || buf[j] !== 0x20) {
      // Not octet-counted: treat the rest as newline-framed.
      out.push(
        ...buf
          .subarray(i)
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim()),
      );
      break;
    }
    const len = Number(buf.subarray(i, j).toString('ascii'));
    // Heroku's count includes the trailing newline.
    out.push(
      buf
        .subarray(j + 1, j + 1 + len)
        .toString('utf8')
        .replace(/\r?\n$/, ''),
    );
    i = j + 1 + len;
  }
  return out;
}

export function logplexToBatch(
  body: string,
  frameId: string | null,
  defaults: Defaults = {},
): Batch {
  const batch = emptyBatch('drain');
  parseOctetFrames(body).forEach((line, idx) => {
    const m = parseSyslog(line);
    if (!m) return;
    // Heroku puts "app" or "heroku" in APP-NAME and the dyno in PROCID; the app name comes from
    // the drain URL (?service=).
    const log = syslogToLog(
      { ...m, appName: defaults.service ?? null },
      { service: defaults.service, environment: defaults.environment },
    );
    log.attributes = { ...log.attributes, 'heroku.source': m.appName, 'heroku.dyno': m.procId };
    log.dedupKey = frameId ? `heroku:${frameId}:${idx}` : null;
    // Heroku router errors: "at=error code=H12 desc=..." are worth an incident.
    const code = /\bat=error code=(H\d+)\b.*?desc="([^"]*)"/.exec(m.message);
    if (code) {
      log.level = 'error';
      log.exception = { type: `Heroku${code[1]}`, message: code[2]!, stack: [] };
    }
    batch.logs.push(log);
    const err = errorFromLog(log, log.dedupKey);
    if (err) batch.errors.push(err);
  });
  return batch;
}
