import type { ErrorBreadcrumb, ErrorExceptionView, ErrorFrameView } from '@ape/api-contracts';

type Obj = Record<string, unknown>;

const MAX_FRAMES = 100;
const MAX_EXCEPTIONS = 10;
const MAX_BREADCRUMBS = 100;
const MAX_TAGS = 50;
const RUM_TAG = 'pramaan_session';
const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|card|cvv/i;

export interface SentryOccurrence {
  eventId: string | null;
  occurredAt: Date;
  level: string | null;
  platform: string | null;
  release: string | null;
  environment: string;
  serverName: string | null;
  transaction: string | null;
  exceptions: ErrorExceptionView[];
  title: string;
  errorType: string;
  message: string;
  fingerprint: string[] | null;
  tags: Record<string, string>;
  user: Record<string, string> | null;
  userKey: string | null;
  breadcrumbs: ErrorBreadcrumb[];
  contexts: Obj;
  request: { url: string | null; method: string | null } | null;
  rumSessionKey: string | null;
}

const obj = (v: unknown): Obj | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null;
const str = (v: unknown, max = 500): string | null =>
  typeof v === 'string' && v ? v.slice(0, max) : typeof v === 'number' ? String(v) : null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const list = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  const values = obj(v)?.values;
  return Array.isArray(values) ? values : [];
};

function toDate(v: unknown, fallback: Date): Date {
  if (typeof v === 'number') return new Date(v * 1000);
  if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return fallback;
}

function frame(raw: unknown): ErrorFrameView | null {
  const f = obj(raw);
  if (!f) return null;
  const line = str(f.context_line, 400);
  const lines = (v: unknown) =>
    Array.isArray(v) ? v.slice(-5).map((s) => (typeof s === 'string' ? s.slice(0, 400) : '')) : [];
  return {
    function: str(f.function, 200),
    file: str(f.abs_path, 500) ?? str(f.filename, 500) ?? str(f.module, 200),
    line: num(f.lineno),
    column: num(f.colno),
    inApp: f.in_app !== false,
    context:
      line !== null ? { pre: lines(f.pre_context), line, post: lines(f.post_context) } : null,
    mapped: false,
  };
}

function exceptions(event: Obj): ErrorExceptionView[] {
  return list(event.exception)
    .slice(-MAX_EXCEPTIONS)
    .map(obj)
    .filter((e): e is Obj => e !== null)
    .map((e) => ({
      type: str(e.type, 200) ?? 'Error',
      value: str(e.value, 2000) ?? '',
      frames: list(obj(e.stacktrace)?.frames)
        .slice(-MAX_FRAMES)
        .map(frame)
        .filter((f): f is ErrorFrameView => f !== null),
    }));
}

function messageOf(event: Obj): string | null {
  const logentry = obj(event.logentry);
  const message = obj(event.message);
  return (
    str(logentry?.formatted, 2000) ??
    str(logentry?.message, 2000) ??
    str(message?.formatted, 2000) ??
    str(message?.message, 2000) ??
    str(event.message, 2000)
  );
}

function tags(event: Obj): Record<string, string> {
  const raw = event.tags;
  const pairs: [unknown, unknown][] = Array.isArray(raw)
    ? raw.filter(Array.isArray).map((p) => [p[0], p[1]] as [unknown, unknown])
    : Object.entries(obj(raw) ?? {});
  const out: Record<string, string> = {};
  for (const [k, v] of pairs.slice(0, MAX_TAGS)) {
    const key = str(k, 64);
    const value = str(v, 200);
    if (key && value !== null)
      out[key] = SECRET_KEY.test(key) && key !== RUM_TAG ? '[REDACTED]' : value;
  }
  return out;
}

function user(event: Obj): Record<string, string> | null {
  const u = obj(event.user);
  if (!u) return null;
  const out: Record<string, string> = {};
  for (const key of ['id', 'email', 'username', 'ip_address', 'segment']) {
    const value = str(u[key], 200);
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function breadcrumbs(event: Obj): ErrorBreadcrumb[] {
  return list(event.breadcrumbs)
    .slice(-MAX_BREADCRUMBS)
    .map(obj)
    .filter((b): b is Obj => b !== null)
    .map((b) => {
      const ts = b.timestamp;
      return {
        ts:
          typeof ts === 'number'
            ? ts * 1000
            : typeof ts === 'string'
              ? Date.parse(ts) || null
              : null,
        category: str(b.category, 100),
        level: str(b.level, 20),
        message: str(b.message, 500) ?? str(JSON.stringify(b.data ?? null), 500),
        type: str(b.type, 40),
      };
    });
}

function contexts(event: Obj): Obj {
  const out: Obj = {};
  for (const [name, value] of Object.entries(obj(event.contexts) ?? {}).slice(0, 20)) {
    const ctx = obj(value);
    if (!ctx) continue;
    out[name] = Object.fromEntries(
      Object.entries(ctx)
        .filter(([k, v]) => !SECRET_KEY.test(k) && (typeof v !== 'object' || v === null))
        .slice(0, 30)
        .map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 300) : v]),
    );
  }
  return out;
}

function request(event: Obj): SentryOccurrence['request'] {
  const r = obj(event.request);
  if (!r) return null;
  const url = str(r.url, 2000);
  return { url: url ? url.split('?')[0]! : null, method: str(r.method, 10) };
}

export function normalizeSentryEvent(event: Obj, now = new Date()): SentryOccurrence {
  const chain = exceptions(event);
  const main = chain[chain.length - 1];
  const message = messageOf(event);
  const errorType = main?.type ?? 'Message';
  const text = main?.value || message || '(no message)';
  const t = tags(event);
  const u = user(event);
  const fp = Array.isArray(event.fingerprint)
    ? event.fingerprint.map((p) => String(p).slice(0, 200)).slice(0, 20)
    : null;
  return {
    eventId: str(event.event_id, 64)?.replace(/-/g, '').toLowerCase() ?? null,
    occurredAt: toDate(event.timestamp, now),
    level: str(event.level, 20),
    platform: str(event.platform, 40),
    release: str(event.release, 200),
    environment: str(event.environment, 120) ?? 'production',
    serverName: str(event.server_name, 200),
    transaction: str(event.transaction, 300) ?? str(event.culprit, 300),
    exceptions: chain,
    title: `${errorType}: ${text}`.slice(0, 300),
    errorType,
    message: text,
    fingerprint: fp && fp.length ? fp : null,
    tags: t,
    user: u,
    userKey: u ? (u.id ?? u.email ?? u.username ?? u.ip_address ?? null) : null,
    breadcrumbs: breadcrumbs(event),
    contexts: contexts(event),
    request: request(event),
    rumSessionKey: t[RUM_TAG] ?? null,
  };
}

export function stackLines(o: SentryOccurrence): string[] {
  const main = o.exceptions[o.exceptions.length - 1];
  if (!main) return [];
  return [...main.frames]
    .reverse()
    .map(
      (f) =>
        `    at ${f.function ?? '<anonymous>'} (${f.file ?? '?'}:${f.line ?? 0}:${f.column ?? 0})`,
    );
}
