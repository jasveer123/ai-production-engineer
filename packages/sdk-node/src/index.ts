import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { format } from 'node:util';
import { activeTraceContext, startTracing } from './otel.ts';
import { redactText, redactValue } from './redact.ts';
import { Transport } from './transport.ts';

export const VERSION = '0.1.0';
const SDK_HEADER = `node/${VERSION}`;

export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StartOptions {
  /** Workspace ingest token. Default: APE_TOKEN. */
  token?: string;
  /** Service name, used to find the right repository. Default: APE_SERVICE, OTEL_SERVICE_NAME, package name. */
  service?: string;
  /** Default: APE_ENVIRONMENT, NODE_ENV, "production". */
  environment?: string;
  /** Version or commit of this build. Default: APE_RELEASE. */
  release?: string;
  /** Intake base URL. Default: APE_ENDPOINT or http://localhost:4000. */
  endpoint?: string;
  /** Send console.* output as logs. Default true. */
  captureConsole?: boolean;
  /** Report uncaught exceptions and unhandled rejections. Default true. */
  captureUncaught?: boolean;
  /** Start OpenTelemetry tracing when its SDK is installed. Default true. */
  tracing?: boolean;
  /** Lowest console level to send. Default "info". */
  minLevel?: Level;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueue?: number;
  /** Print agent problems to stderr. Default true. */
  debug?: boolean;
  /** For tests. */
  fetch?: typeof fetch;
}

export interface ErrorContext {
  route?: string;
  method?: string;
  statusCode?: number;
  handled?: boolean;
  level?: Level;
  [key: string]: unknown;
}

const RANK: Record<Level, number> = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };

interface State {
  transport: Transport;
  service: string;
  environment: string;
  release: string | null;
  host: string;
  minLevel: Level;
  restore: (() => void)[];
  stopTracing: (() => Promise<void>) | null;
}

let state: State | null = null;
// Original console methods: agent warnings must never be captured as app logs.
const original = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};
let inside = false;

function packageName(): string | null {
  try {
    const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8')) as {
      name?: string;
    };
    return pkg.name?.replace(/^@[^/]+\//, '') ?? null;
  } catch {
    return null;
  }
}

/** Starts the agent. Call it first thing in your entry file. Safe to call twice (no-op). */
export function start(options: StartOptions = {}): boolean {
  if (state) return true;
  const debug = options.debug ?? true;
  const warn = (m: string) => {
    if (debug) original.error.call(console, `[ape-agent] ${m}`);
  };
  const token = options.token ?? process.env.APE_TOKEN;
  if (!token) {
    warn('no token (set APE_TOKEN or pass { token }); nothing will be sent');
    return false;
  }
  const endpoint = (
    options.endpoint ??
    process.env.APE_ENDPOINT ??
    'http://localhost:4000'
  ).replace(/\/+$/, '');
  const service =
    options.service ??
    process.env.APE_SERVICE ??
    process.env.OTEL_SERVICE_NAME ??
    packageName() ??
    'node-app';
  const environment =
    options.environment ?? process.env.APE_ENVIRONMENT ?? process.env.NODE_ENV ?? 'production';
  const release = options.release ?? process.env.APE_RELEASE ?? null;

  const transport = new Transport({
    endpoint,
    token,
    batchSize: options.batchSize ?? 100,
    flushIntervalMs: options.flushIntervalMs ?? 2000,
    maxQueue: options.maxQueue ?? 10_000,
    sdkHeader: SDK_HEADER,
    warn,
    fetch: options.fetch,
  });
  state = {
    transport,
    service,
    environment,
    release,
    host: hostname(),
    minLevel: options.minLevel ?? 'info',
    restore: [],
    stopTracing: null,
  };

  if (options.tracing ?? true) {
    state.stopTracing = startTracing({
      endpoint,
      token,
      service,
      environment,
      release,
      sdkHeader: SDK_HEADER,
      warn,
    });
  }
  if (options.captureConsole ?? true) patchConsole(state);
  if (options.captureUncaught ?? true) hookProcess(state);

  const onExit = () => void flush();
  process.once('beforeExit', onExit);
  state.restore.push(() => process.removeListener('beforeExit', onExit));
  return true;
}

function patchConsole(s: State): void {
  const map: [keyof typeof original, Level][] = [
    ['log', 'info'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['debug', 'debug'],
  ];
  for (const [method, level] of map) {
    const orig = original[method];
    console[method] = (...args: unknown[]) => {
      orig.apply(console, args);
      if (inside) return;
      const err = args.find((a): a is Error => a instanceof Error);
      log(
        level,
        format(...args),
        err ? { 'exception.type': err.name, 'exception.stacktrace': err.stack } : undefined,
      );
    };
    s.restore.push(() => (console[method] = orig));
  }
}

function hookProcess(s: State): void {
  const onUncaught = (err: unknown) => {
    captureException(err, { handled: false, level: 'fatal' });
    // Keep Node's default behaviour when nobody else handles it: print and exit with 1.
    if (process.listenerCount('uncaughtException') === 1) {
      void flush(2000).finally(() => {
        original.error.call(console, err);
        process.exit(1);
      });
    }
  };
  const onRejection = (reason: unknown) => {
    captureException(reason, { handled: false, level: 'fatal', mechanism: 'unhandledRejection' });
    // Node's default (--unhandled-rejections=throw) crashes; adding a listener disables that.
    const mode = process.execArgv
      .find((a) => a.startsWith('--unhandled-rejections='))
      ?.split('=')[1];
    if (process.listenerCount('unhandledRejection') === 1 && mode !== 'warn' && mode !== 'none') {
      void flush(2000).finally(() => {
        original.error.call(console, reason);
        process.exit(1);
      });
    }
  };
  process.on('uncaughtException', onUncaught);
  process.on('unhandledRejection', onRejection);
  s.restore.push(() => {
    process.removeListener('uncaughtException', onUncaught);
    process.removeListener('unhandledRejection', onRejection);
  });
}

/** Sends one log line. Attributes are redacted before they leave the process. */
export function log(level: Level, message: string, attributes?: Record<string, unknown>): void {
  const s = state;
  if (!s || RANK[level] < RANK[s.minLevel]) return;
  inside = true;
  try {
    const trace = activeTraceContext();
    s.transport.enqueue('logs', {
      timestamp: new Date().toISOString(),
      level,
      message: redactText(message).slice(0, 32_000),
      service: s.service,
      environment: s.environment,
      host: s.host,
      trace_id: trace?.traceId,
      span_id: trace?.spanId,
      ...(s.release ? { release: s.release } : {}),
      ...(attributes ? (redactValue(attributes) as Record<string, unknown>) : {}),
    });
  } catch {
    // never break the app
  } finally {
    inside = false;
  }
}

/** Reports an exception. Returns the event id, or null when the agent is not started. */
export function captureException(error: unknown, context: ErrorContext = {}): string | null {
  const s = state;
  if (!s) return null;
  inside = true;
  try {
    const err =
      error instanceof Error ? error : new Error(typeof error === 'string' ? error : format(error));
    const { route, method, statusCode, handled, level, ...rest } = context;
    const trace = activeTraceContext();
    const id = randomUUID();
    s.transport.enqueue('errors', {
      event_id: id,
      timestamp: new Date().toISOString(),
      service: s.service,
      environment: s.environment,
      release: s.release ?? undefined,
      level: level ?? 'error',
      type: err.name || err.constructor?.name || 'Error',
      message: redactText(err.message ?? '').slice(0, 4000),
      stack: redactText(err.stack ?? ''),
      trace_id: trace?.traceId,
      span_id: trace?.spanId,
      route,
      method,
      status_code: statusCode,
      host: s.host,
      runtime: `node ${process.version}`,
      handled: handled ?? true,
      context: redactValue(rest),
    });
    return id;
  } catch {
    return null;
  } finally {
    inside = false;
  }
}

/** Sends everything queued. Resolves after `timeoutMs` at the latest. */
export function flush(timeoutMs = 5000): Promise<void> {
  if (!state) return Promise.resolve();
  return Promise.race([
    state.transport.flush(),
    new Promise<void>((r) => setTimeout(r, timeoutMs).unref()),
  ]);
}

/** Flushes and removes every hook. */
export async function shutdown(): Promise<void> {
  const s = state;
  if (!s) return;
  await flush();
  await s.stopTracing?.().catch(() => undefined);
  for (const undo of s.restore.reverse()) undo();
  state = null;
}

export const isStarted = () => state !== null;

type Req = {
  method?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
  baseUrl?: string;
};
type Res = { statusCode?: number };

/**
 * Express / Connect error middleware. Add it after your routes:
 * `app.use(errorHandler())`. It reports the error and passes it on unchanged.
 */
export function errorHandler() {
  return (err: unknown, req: Req, res: Res, next: (e?: unknown) => void) => {
    const route = req.route?.path
      ? `${req.baseUrl ?? ''}${req.route.path}`
      : (req.originalUrl ?? req.url ?? '').split('?')[0];
    const status =
      (err as { status?: number; statusCode?: number }).status ??
      (err as { statusCode?: number }).statusCode;
    if (!status || status >= 500) {
      captureException(err, {
        route,
        method: req.method,
        statusCode: status ?? 500,
        handled: true,
      });
    }
    next(err);
  };
}

export default { start, log, captureException, flush, shutdown, errorHandler, isStarted };
