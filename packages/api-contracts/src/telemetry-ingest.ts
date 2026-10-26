import { z } from 'zod';

export const INGEST_WAYS = ['package', 'otlp', 'http', 'agent', 'drain'] as const;
export type IngestWay = (typeof INGEST_WAYS)[number] | 'syslog';

export const createIngestTokenSchema = z.object({ name: z.string().trim().min(1).max(80) });
export type CreateIngestTokenInput = z.infer<typeof createIngestTokenSchema>;

export interface IngestToken {
  id: string;
  name: string;
  /** `ape_live_••••abcd`: the full token is only returned once. */
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface IngestTokenWithSecret extends IngestToken {
  token: string;
}

export type StreamState = 'receiving' | 'silent' | 'not_set_up';

export interface IngestStream {
  way: IngestWay;
  serviceName: string;
  environment: string;
  host: string | null;
  state: StreamState;
  firstReceivedAt: string;
  lastReceivedAt: string;
  logCount: number;
  spanCount: number;
  errorCount: number;
  metricCount: number;
}

export interface IngestOverview {
  /** Base URL for every way, e.g. https://ingest.example.com (OTLP appends /v1/...). */
  ingestUrl: string;
  syslog: { host: string; port: number; tls: boolean } | null;
  tokens: IngestToken[];
  ways: { way: IngestWay; state: StreamState; lastReceivedAt: string | null }[];
  streams: IngestStream[];
}
