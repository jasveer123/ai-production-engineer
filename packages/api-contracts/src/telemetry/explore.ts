import { z } from 'zod';
import {
  coercedInt,
  isoDateTimeSchema,
  nameSchema,
  type Attributes,
  type IsoTimestamp,
  type Uuid,
} from '../common';
import type { LogLine } from './logs';

export const RELATIVE_RANGES = [
  '5m',
  '15m',
  '1h',
  '3h',
  '6h',
  '12h',
  '24h',
  '3d',
  '7d',
  '14d',
] as const;
export type RelativeRange = (typeof RELATIVE_RANGES)[number];

export const MAX_RANGE_DAYS = 14;

export const rangeQuerySchema = z.object({
  q: z.string().max(1000).default(''),
  range: z.enum(RELATIVE_RANGES).optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});
export type RangeQuery = z.input<typeof rangeQuerySchema>;

export const logExploreQuerySchema = rangeQuerySchema.extend({
  cursor: z.string().max(200).optional(),
  limit: coercedInt(500, 100),
});
export type LogExploreQuery = z.input<typeof logExploreQuerySchema>;

export interface QueryMeta {
  from: IsoTimestamp;
  to: IsoTimestamp;
  matched: number;
  matchedCapped: boolean;
  returned: number;
  truncated: boolean;
  tookMs: number;
}

export interface LevelBucket {
  at: IsoTimestamp;
  total: number;
  levels: Record<string, number>;
}

export interface LogExploreResult {
  lines: LogLine[];
  nextCursor: string | null;
  histogram: LevelBucket[];
  bucketMs: number;
  meta: QueryMeta;
}

export const logFacetsQuerySchema = rangeQuerySchema.extend({
  field: z
    .string()
    .max(100)
    .regex(/^[A-Za-z0-9_.@:/-]+$/)
    .optional(),
});
export type LogFacetsQuery = z.input<typeof logFacetsQuerySchema>;

export interface FacetValue {
  value: string;
  count: number;
}

export interface LogFacets {
  fields: { field: string; values: FacetValue[] }[];
  attributeKeys: FacetValue[];
  sampled: number;
}

export const logContextQuerySchema = z.object({ size: coercedInt(100, 20) });

export interface LogContext {
  anchor: LogLine;
  before: LogLine[];
  after: LogLine[];
}

export const tailQuerySchema = z.object({
  q: z.string().max(1000).default(''),
  after: z.coerce.number().int().nonnegative().optional(),
  limit: coercedInt(500, 200),
});
export type TailQuery = z.input<typeof tailQuerySchema>;

export interface TailResult {
  lines: LogLine[];
  cursor: number;
  gap: boolean;
}

export const traceSearchQuerySchema = rangeQuerySchema.extend({
  before: isoDateTimeSchema.optional(),
  limit: coercedInt(100, 50),
});
export type TraceSearchQuery = z.input<typeof traceSearchQuerySchema>;

export interface TraceSummary {
  traceId: string;
  start: IsoTimestamp;
  durationMs: number;
  spanCount: number;
  error: boolean;
  rootService: string | null;
  rootOperation: string | null;
  services: string[];
}

export interface TraceSearchResult {
  traces: TraceSummary[];
  nextBefore: IsoTimestamp | null;
  meta: QueryMeta;
}

export interface SpanEventView {
  name: string;
  time: string;
  attributes: Attributes;
}

export interface WaterfallSpan {
  spanId: string;
  parentSpanId: string | null;
  service: string;
  environment: string;
  name: string;
  kind: number;
  start: IsoTimestamp;
  offsetMs: number;
  durationMs: number;
  statusCode: number;
  statusMessage: string | null;
  attributes: Attributes;
  events: SpanEventView[];
  depth: number;
  orphan: boolean;
}

export interface TraceDetail {
  traceId: string;
  start: IsoTimestamp | null;
  durationMs: number;
  spans: WaterfallSpan[];
  missingRoot: boolean;
  orphanCount: number;
  truncated: boolean;
  logs: LogLine[];
}

export interface OperationStats {
  service: string;
  operation: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ServiceRed {
  service: string;
  requests: number;
  ratePerMin: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  lastSeen: IsoTimestamp;
}

export interface ServiceEdge {
  from: string;
  to: string;
  calls: number;
  errors: number;
  errorRate: number;
  avgMs: number;
  lastSeen: IsoTimestamp;
  confidence: 'client_server' | 'parent_child';
}

export interface ServiceMap {
  from: IsoTimestamp;
  to: IsoTimestamp;
  services: ServiceRed[];
  edges: ServiceEdge[];
}

export const SAVED_QUERY_SIGNALS = ['logs', 'traces'] as const;

export const createSavedQuerySchema = z.object({
  name: nameSchema(120),
  signal: z.enum(SAVED_QUERY_SIGNALS),
  query: z.string().max(1000),
  range: z.string().max(80).default('1h'),
});
export type CreateSavedQueryInput = z.input<typeof createSavedQuerySchema>;

export interface SavedQuery {
  id: Uuid;
  name: string;
  signal: (typeof SAVED_QUERY_SIGNALS)[number];
  query: string;
  range: string;
  createdBy: Uuid | null;
  createdAt: IsoTimestamp;
}

export interface SourceView {
  id: Uuid;
  name: string;
  platform: string | null;
  masked: string;
  createdAt: IsoTimestamp;
  lastUsedAt: IsoTimestamp | null;
  pausedAt: IsoTimestamp | null;
}

export interface SourcesOverview {
  ingestUrl: string;
  sources: SourceView[];
  volume24h: { way: string; logs: number; lastAt: IsoTimestamp | null }[];
}
