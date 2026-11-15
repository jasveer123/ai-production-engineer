import { sql } from 'drizzle-orm';
import { logRecords, spans } from '../../../core/db/schema';
import type { FieldTarget, QuerySchema } from './compile-query';

const text = (column: unknown): FieldTarget => ({ column: sql`${column}`, kind: 'text' });

export const LOG_SCHEMA: QuerySchema = {
  fields: {
    level: { column: sql`${logRecords.level}`, kind: 'level' },
    service: text(logRecords.service),
    env: text(logRecords.environment),
    environment: text(logRecords.environment),
    host: text(logRecords.host),
    source: text(logRecords.way),
    way: text(logRecords.way),
    trace: text(logRecords.traceId),
    trace_id: text(logRecords.traceId),
    span: text(logRecords.spanId),
    message: text(logRecords.message),
  },
  attributes: sql`${logRecords.attributes}`,
  text: sql`${logRecords.message}`,
};

export const SPAN_SCHEMA: QuerySchema = {
  fields: {
    service: text(spans.service),
    env: text(spans.environment),
    environment: text(spans.environment),
    operation: text(spans.name),
    name: text(spans.name),
    trace: text(spans.traceId),
    trace_id: text(spans.traceId),
    status: { column: sql`${spans.statusCode}`, kind: 'status' },
    kind: { column: sql`${spans.kind}`, kind: 'number' },
    duration: { column: sql`${spans.durationMs}`, kind: 'number' },
  },
  attributes: sql`${spans.attributes}`,
  text: sql`${spans.name}`,
};
