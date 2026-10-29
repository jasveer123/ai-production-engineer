import { z } from 'zod';
import {
  coercedInt,
  isoDateTimeSchema,
  type Attributes,
  type IsoTimestamp,
  type ValueOf,
} from '../common';
import type { IngestWay } from './ingest';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = ValueOf<typeof LOG_LEVELS>;

export const logQuerySchema = z.object({
  q: z.string().max(500).default(''),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: coercedInt(500, 100),
});
export type LogQuery = z.input<typeof logQuerySchema>;

export interface LogLine {
  id: number;
  ts: IsoTimestamp;
  service: string;
  environment: string;
  level: LogLevel;
  message: string;
  attributes: Attributes;
  traceId: string | null;
  spanId: string | null;
  host: string | null;
  way: IngestWay;
}

export interface LogSearchResult {
  lines: LogLine[];
  histogram: { at: IsoTimestamp; total: number; errors: number }[];
  nextBefore: number | null;
  services: string[];
}
