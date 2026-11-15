import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid, type ValueOf, type WithSecret } from '../common';

export const INGEST_WAYS = ['package', 'otlp', 'http', 'agent', 'drain'] as const;
export type IngestWay = ValueOf<typeof INGEST_WAYS> | 'syslog';

export const INGEST_PLATFORMS = [
  'opentelemetry',
  'docker',
  'kubernetes',
  'vector',
  'fluent-bit',
  'javascript',
  'python',
  'ubuntu',
  'aws',
  'http',
] as const;
export type IngestPlatform = ValueOf<typeof INGEST_PLATFORMS>;

export const createIngestTokenSchema = z.object({
  name: nameSchema(80),
  platform: z.enum(INGEST_PLATFORMS).optional(),
});
export type CreateIngestTokenInput = z.infer<typeof createIngestTokenSchema>;

export interface IngestToken {
  id: Uuid;
  name: string;
  platform: IngestPlatform | null;
  masked: string;
  createdAt: IsoTimestamp;
  lastUsedAt: IsoTimestamp | null;
  revokedAt: IsoTimestamp | null;
}

export type IngestTokenWithSecret = WithSecret<IngestToken, 'token'>;

export type StreamState = 'receiving' | 'silent' | 'not_set_up';

export interface SyslogEndpoint {
  host: string;
  port: number;
  tls: boolean;
}

export interface IngestStream {
  way: IngestWay;
  serviceName: string;
  environment: string;
  host: string | null;
  state: StreamState;
  firstReceivedAt: IsoTimestamp;
  lastReceivedAt: IsoTimestamp;
  logCount: number;
  spanCount: number;
  errorCount: number;
  metricCount: number;
}

export interface IngestOverview {
  ingestUrl: string;
  syslog: SyslogEndpoint | null;
  tokens: IngestToken[];
  ways: { way: IngestWay; state: StreamState; lastReceivedAt: IsoTimestamp | null }[];
  streams: IngestStream[];
}

export type IngestBatchState = 'processing' | 'completed' | 'failed';

export interface IngestBatchView {
  id: Uuid;
  route: string;
  signal: string;
  idempotencyKey: string | null;
  state: IngestBatchState;
  counts: { received: number; accepted: number; rejected: number };
  sinks: Partial<Record<'logs' | 'spans' | 'errors' | 'points', number>>;
  rejections: { index: number; code: string }[];
  error: string | null;
  createdAt: IsoTimestamp;
  completedAt: IsoTimestamp | null;
}

export interface IngestResult {
  receiptId: string | null;
  accepted: number;
  rejected: number;
  rejections: { index: number; code: string }[];
}
