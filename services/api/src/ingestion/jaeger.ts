import type { JaegerErrorPayload } from './normalize';

interface KeyValue {
  key: string;
  value: unknown;
}
interface JaegerSpan {
  traceID: string;
  spanID: string;
  operationName: string;
  startTime: number; // microseconds
  processID: string;
  tags: KeyValue[];
  logs?: { timestamp: number; fields: KeyValue[] }[];
}
export interface JaegerTrace {
  traceID: string;
  spans: JaegerSpan[];
  processes: Record<string, { serviceName: string; tags: KeyValue[] }>;
}

const tag = (kvs: KeyValue[] | undefined, ...keys: string[]) => {
  for (const k of keys) {
    const v = kvs?.find((t) => t.key === k)?.value;
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

/** Tag value as a string; Jaeger tag values are strings, numbers or booleans. */
const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : fallback;

/**
 * Reduces one Jaeger trace to at most one error event for `serviceName`: the deepest recorded
 * exception, or, without one, the failing HTTP server span (e.g. a 504 from a timeout).
 */
export function extractError(trace: JaegerTrace, serviceName: string): JaegerErrorPayload | null {
  const spans = trace.spans.filter(
    (s) => trace.processes[s.processID]?.serviceName === serviceName,
  );
  if (spans.length === 0) return null;
  const process = trace.processes[spans[0]!.processID]!;
  const environment = str(
    tag(process.tags, 'deployment.environment.name', 'deployment.environment'),
    'unknown',
  );

  const server = spans.find((s) => tag(s.tags, 'span.kind') === 'server');
  const httpRoute = (tag(server?.tags, 'http.route') as string | undefined) ?? null;
  const statusRaw = tag(server?.tags, 'http.response.status_code', 'http.status_code');
  const httpStatus = statusRaw === undefined ? null : Number(statusRaw);

  // 4xx responses are the client's problem (bad input, declined card), not an incident.
  if (httpStatus !== null && httpStatus < 500) return null;

  const withException = spans
    .flatMap((s) =>
      (s.logs ?? [])
        .filter((l) => tag(l.fields, 'event') === 'exception')
        .map((l) => ({ span: s, fields: l.fields })),
    )
    .sort((a, b) => b.span.startTime - a.span.startTime);
  const deepest = withException[0];

  if (deepest) {
    const stack = str(tag(deepest.fields, 'exception.stacktrace'), '')
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('at '))
      .slice(0, 8);
    return {
      traceId: trace.traceID,
      spanId: deepest.span.spanID,
      serviceName,
      environment,
      operation: (server ?? deepest.span).operationName,
      httpRoute,
      httpStatus,
      exceptionType: str(tag(deepest.fields, 'exception.type'), 'Error'),
      exceptionMessage: str(tag(deepest.fields, 'exception.message'), '').slice(0, 1000),
      stack,
      occurredAt: new Date(deepest.span.startTime / 1000).toISOString(),
    };
  }

  const failed =
    server && tag(server.tags, 'error') === true && httpStatus !== null && httpStatus >= 500;
  if (!failed) return null;
  return {
    traceId: trace.traceID,
    spanId: server.spanID,
    serviceName,
    environment,
    operation: server.operationName,
    httpRoute,
    httpStatus,
    exceptionType: `HTTP ${httpStatus}`,
    exceptionMessage: `${server.operationName} returned ${httpStatus}`,
    stack: [],
    occurredAt: new Date(server.startTime / 1000).toISOString(),
  };
}

/** Minimal Jaeger query API client. The base URL comes from platform config, never from users. */
export class JaegerClient {
  constructor(private readonly baseUrl: string) {}

  async services(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/services`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Jaeger returned ${res.status}`);
    return ((await res.json()) as { data: string[] | null }).data ?? [];
  }

  async errorTraces(
    service: string,
    startMicros: number,
    endMicros: number,
  ): Promise<JaegerTrace[]> {
    const params = new URLSearchParams({
      service,
      start: String(startMicros),
      end: String(endMicros),
      limit: '500',
      tags: JSON.stringify({ error: 'true' }),
    });
    const res = await fetch(`${this.baseUrl}/api/traces?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Jaeger returned ${res.status}`);
    return ((await res.json()) as { data: JaegerTrace[] | null }).data ?? [];
  }
}
