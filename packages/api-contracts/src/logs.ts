import { z } from 'zod';
import { IngestWay } from './telemetry-ingest';

export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const logQuerySchema = z.object({
  /** `level:error service:x env:prod trace:abc host:h "exact phrase" words` */
  q: z.string().max(500).default(''),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /** Id of the last line of the previous page (newest first). */
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type LogQuery = z.input<typeof logQuerySchema>;

export interface LogLine {
  id: number;
  ts: string;
  service: string;
  environment: string;
  level: LogLevel;
  message: string;
  attributes: Record<string, unknown>;
  traceId: string | null;
  spanId: string | null;
  host: string | null;
  way: IngestWay;
}

export interface LogSearchResult {
  lines: LogLine[];
  /** Counts per bucket over [from, to], oldest first. */
  histogram: { at: string; total: number; errors: number }[];
  nextBefore: number | null;
  services: string[];
}
