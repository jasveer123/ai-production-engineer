import { createHash } from 'node:crypto';
import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../../core/common/errors';
import { PermanentIngestError } from '../../ingest/ingestion/domain/normalize';
import type { HeartbeatSignal } from './domain/heartbeat';
import { parseAlerts } from './domain/parsers';

export function validationProblem(kind: string, body: Record<string, unknown>): string | null {
  try {
    parseAlerts(kind, body);
    return null;
  } catch (err) {
    if (err instanceof PermanentIngestError) return err.message.slice(0, 1000);
    throw err;
  }
}

export function tokenOf(req: Request): string | undefined {
  const auth = req.header('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return (
    req.header('x-ape-token') ?? (typeof req.query.token === 'string' ? req.query.token : undefined)
  );
}

export function parseSnsBody(req: Request): Record<string, unknown> | null {
  const body: unknown = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body) && 'Type' in body) return body;
  if (typeof body !== 'string') return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const unauthorized = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, 'invalid_token', 'Unknown alert source or bad token');

export const SIGNALS = new Set<HeartbeatSignal>(['fail', 'start']);

export function eventIdOf(req: Request, body: Record<string, unknown>): string {
  const header = req.header('idempotency-key') ?? req.header('x-event-id');
  if (header) return `hdr:${header.slice(0, 200)}`;
  if (typeof body.MessageId === 'string') return `sns:${body.MessageId}`;
  return createHash('sha256')
    .update(req.rawBody ?? JSON.stringify(body))
    .digest('hex');
}

export function executionIdOf(req: Request): string | null {
  const q = req.query.execution_id ?? req.query.executionId;
  const body = req.body as { executionId?: unknown } | undefined;
  const raw =
    (typeof q === 'string' ? q : undefined) ??
    req.header('x-execution-id') ??
    (typeof body?.executionId === 'string' ? body.executionId : undefined);
  return raw ? raw.trim().slice(0, 200) || null : null;
}

export function bodyText(req: Request): string | null {
  if (typeof req.body === 'string') return req.body;
  return req.rawBody?.length ? req.rawBody.toString('utf8') : null;
}
