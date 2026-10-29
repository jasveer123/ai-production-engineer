import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid, type ValueOf, type WithSecret } from '../common';

export const INGEST_WAYS = ['package', 'otlp', 'http', 'agent', 'drain'] as const;
export type IngestWay = ValueOf<typeof INGEST_WAYS> | 'syslog';

export const createIngestTokenSchema = z.object({ name: nameSchema(80) });
export type CreateIngestTokenInput = z.infer<typeof createIngestTokenSchema>;

export interface IngestToken {
  id: Uuid;
  name: string;
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
