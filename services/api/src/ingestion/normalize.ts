import { createHash } from 'node:crypto';
import { z } from 'zod';

/** One shape for every source, so dedup and correlation don't care where an event came from. */
export type NormalizedEvent =
  | {
      kind: 'deploy';
      serviceName: string;
      environment: string;
      commitSha: string;
      version: string | null;
      occurredAt: Date;
    }
  | {
      kind: 'error';
      serviceName: string;
      environment: string;
      title: string;
      errorType: string;
      message: string;
      fingerprint: string;
      traceId: string | null;
      occurredAt: Date;
      attributes: Record<string, unknown>;
    };

/** Thrown for payloads that can never succeed; the event goes straight to the dead-letter queue. */
export class PermanentIngestError extends Error {
  constructor(
    readonly reasonCode: string,
    message: string,
  ) {
    super(message);
  }
}

export const deployPayloadSchema = z.object({
  service: z.string().trim().min(1).max(100),
  commit_sha: z.string().regex(/^[0-9a-f]{7,40}$|^unknown$/i),
  version: z.string().max(100).optional(),
  env: z.string().trim().min(1).max(40),
  deployed_at: z.string().datetime().optional(),
});

/** Fields extracted from an error span by the Jaeger poller. */
export const jaegerErrorPayloadSchema = z.object({
  traceId: z.string().regex(/^[0-9a-f]{16,32}$/),
  spanId: z.string(),
  serviceName: z.string().min(1),
  environment: z.string().min(1),
  operation: z.string(),
  httpRoute: z.string().nullable(),
  httpStatus: z.number().nullable(),
  exceptionType: z.string(),
  exceptionMessage: z.string(),
  stack: z.array(z.string()).max(10),
  occurredAt: z.string().datetime(),
});
export type JaegerErrorPayload = z.infer<typeof jaegerErrorPayloadSchema>;

/** Error events from the telemetry intake: OTLP, our SDKs, HTTP API, agents and drains. */
export const ingestErrorPayloadSchema = z.object({
  way: z.string(),
  serviceName: z.string().min(1),
  environment: z.string().min(1),
  errorType: z.string().min(1),
  message: z.string(),
  stack: z.array(z.string()).max(50),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  occurredAt: z.string().datetime(),
  route: z.string().nullable(),
  httpStatus: z.number().nullable(),
  operation: z.string().nullable(),
  release: z.string().nullable(),
  attributes: z.record(z.unknown()).default({}),
});

/** Strips per-request noise (ids, numbers) so the same bug always gets the same message. */
export function messageTemplate(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
}

/** "at Foo.bar (/abs/path/src/x.ts:81:46)" -> "Foo.bar src/x.ts" (line numbers move between releases). */
export function frameSignature(frame: string | undefined): string {
  if (!frame) return '';
  const m = /at\s+(?:async\s+)?([^\s(]+)?\s*\(?([^():]+)(?::\d+){0,2}\)?/.exec(frame.trim());
  if (!m) return frame.trim();
  const file = (m[2] ?? '').split('/').slice(-2).join('/');
  return `${m[1] ?? '<anonymous>'} ${file}`.trim();
}

export function errorFingerprint(parts: {
  serviceName: string;
  environment: string;
  errorType: string;
  message: string;
  topFrame?: string;
  route?: string | null;
}): string {
  const key = [
    parts.serviceName,
    parts.environment,
    parts.errorType,
    messageTemplate(parts.message),
    frameSignature(parts.topFrame),
    parts.route ?? '',
  ].join('|');
  return `err:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
}

export function normalize(source: string, payload: unknown): NormalizedEvent {
  if (source === 'deploy_webhook') {
    const p = deployPayloadSchema.safeParse(payload);
    if (!p.success) throw new PermanentIngestError('invalid_payload', p.error.message);
    return {
      kind: 'deploy',
      serviceName: p.data.service,
      environment: p.data.env,
      commitSha: p.data.commit_sha,
      version: p.data.version ?? null,
      occurredAt: p.data.deployed_at ? new Date(p.data.deployed_at) : new Date(),
    };
  }
  if (source === 'otel_jaeger') {
    const p = jaegerErrorPayloadSchema.safeParse(payload);
    if (!p.success) throw new PermanentIngestError('invalid_payload', p.error.message);
    const e = p.data;
    const where = e.httpRoute ?? e.operation;
    return {
      kind: 'error',
      serviceName: e.serviceName,
      environment: e.environment,
      errorType: e.exceptionType,
      message: e.exceptionMessage,
      title:
        `${e.exceptionType}: ${e.exceptionMessage}`.slice(0, 160) + (where ? ` (${where})` : ''),
      fingerprint: errorFingerprint({
        serviceName: e.serviceName,
        environment: e.environment,
        errorType: e.exceptionType,
        message: e.exceptionMessage,
        topFrame: e.stack[0],
        route: e.httpRoute,
      }),
      traceId: e.traceId,
      occurredAt: new Date(e.occurredAt),
      attributes: {
        operation: e.operation,
        httpRoute: e.httpRoute,
        httpStatus: e.httpStatus,
        spanId: e.spanId,
        stack: e.stack,
      },
    };
  }
  if (source === 'ingest_error') {
    const p = ingestErrorPayloadSchema.safeParse(payload);
    if (!p.success) throw new PermanentIngestError('invalid_payload', p.error.message);
    const e = p.data;
    const where = e.route ?? e.operation;
    return {
      kind: 'error',
      serviceName: e.serviceName,
      environment: e.environment,
      errorType: e.errorType,
      message: e.message,
      title: `${e.errorType}: ${e.message}`.slice(0, 160) + (where ? ` (${where})` : ''),
      fingerprint: errorFingerprint({
        serviceName: e.serviceName,
        environment: e.environment,
        errorType: e.errorType,
        message: e.message,
        topFrame: e.stack[0],
        route: e.route,
      }),
      traceId: e.traceId,
      occurredAt: new Date(e.occurredAt),
      attributes: {
        operation: e.operation,
        httpRoute: e.route,
        httpStatus: e.httpStatus,
        spanId: e.spanId,
        stack: e.stack,
        way: e.way,
        release: e.release,
        ...e.attributes,
      },
    };
  }
  throw new PermanentIngestError('unknown_source', `No normalizer for source "${source}"`);
}
