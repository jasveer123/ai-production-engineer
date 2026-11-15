import { createHash } from 'node:crypto';
import type { MetricHistogram } from '../../../core/db/schema';
import {
  attributesOf,
  nanosToDate,
  resourceInfo,
  type KeyValue,
  type Resource,
  type ResourceInfo,
} from './otlp';
import { emptyBatch, reject, type Batch, type MetricPointInput } from './types';

type Nanos = string | number;
type Temporality = number | string | undefined;

interface OtlpPoint {
  attributes?: KeyValue[];
  startTimeUnixNano?: Nanos;
  timeUnixNano?: Nanos;
  asDouble?: number;
  asInt?: Nanos;
  count?: Nanos;
  sum?: number;
  min?: number;
  max?: number;
  bucketCounts?: Nanos[];
  explicitBounds?: number[];
  scale?: number;
  zeroCount?: Nanos;
  positive?: { offset?: number; bucketCounts?: Nanos[] };
  negative?: { offset?: number; bucketCounts?: Nanos[] };
}

interface Points {
  dataPoints?: OtlpPoint[];
  aggregationTemporality?: Temporality;
  isMonotonic?: boolean;
}

interface OtlpMetric {
  name?: string;
  unit?: string;
  gauge?: Points;
  sum?: Points;
  histogram?: Points;
  exponentialHistogram?: Points;
  summary?: Points;
}

interface Scope {
  name?: string;
  version?: string;
}

interface MetricsRequest {
  resourceMetrics?: {
    resource?: Resource;
    scopeMetrics?: { scope?: Scope; metrics?: unknown[] }[];
  }[];
}

export const MAX_METRIC_POINTS = 5000;
const MAX_BUCKETS = 512;

interface Context {
  res: ResourceInfo;
  scope: string | null;
  name: string;
  unit: string | null;
}

const num = (v: unknown): number => (v === undefined || v === null ? Number.NaN : Number(v));
const counts = (v: Nanos[] | undefined): number[] => (v ?? []).map(num);
const finiteOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function temporalityOf(t: Temporality): 'cumulative' | 'delta' | null {
  if (t === 1 || t === 'AGGREGATION_TEMPORALITY_DELTA') return 'delta';
  if (t === 2 || t === 'AGGREGATION_TEMPORALITY_CUMULATIVE') return 'cumulative';
  return null;
}

export function seriesKeyOf(parts: {
  resource: Record<string, unknown>;
  scope: string | null;
  name: string;
  attributes: Record<string, unknown>;
}): string {
  const sorted = (o: Record<string, unknown>) =>
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]);
  const raw = JSON.stringify([
    sorted(parts.resource),
    parts.scope,
    parts.name,
    sorted(parts.attributes),
  ]);
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function explicitHistogram(p: OtlpPoint): MetricHistogram | null {
  const bounds = (p.explicitBounds ?? []).map(Number);
  const bucketCounts = counts(p.bucketCounts);
  const count = num(p.count);
  if (!Number.isFinite(count) || count < 0) return null;
  if (bucketCounts.length > MAX_BUCKETS || bucketCounts.some((c) => !Number.isFinite(c)))
    return null;
  if (bucketCounts.length > 0 && bucketCounts.length !== bounds.length + 1) return null;
  if (bounds.some((b, i) => !Number.isFinite(b) || (i > 0 && b <= bounds[i - 1]!))) return null;
  return {
    type: 'explicit',
    count,
    sum: finiteOrNull(p.sum),
    min: finiteOrNull(p.min),
    max: finiteOrNull(p.max),
    bounds,
    counts: bucketCounts,
  };
}

function exponentialHistogram(p: OtlpPoint): MetricHistogram | null {
  const count = num(p.count);
  const scale = Number(p.scale ?? 0);
  const positive = counts(p.positive?.bucketCounts);
  const negative = counts(p.negative?.bucketCounts);
  if (!Number.isFinite(count) || count < 0 || !Number.isInteger(scale)) return null;
  if (scale < -10 || scale > 20 || positive.length + negative.length > MAX_BUCKETS) return null;
  return {
    type: 'exponential',
    count,
    sum: finiteOrNull(p.sum),
    min: finiteOrNull(p.min),
    max: finiteOrNull(p.max),
    scale,
    zeroCount: num(p.zeroCount ?? 0) || 0,
    positive: { offset: Number(p.positive?.offset ?? 0), counts: positive },
    negative: { offset: Number(p.negative?.offset ?? 0), counts: negative },
  };
}

type Shape = 'gauge' | 'sum' | 'histogram' | 'exponentialHistogram';

function valueOf(shape: Shape, p: OtlpPoint) {
  if (shape === 'gauge' || shape === 'sum') {
    const value = p.asDouble !== undefined ? p.asDouble : num(p.asInt);
    return Number.isFinite(value) ? { value, histogram: null } : null;
  }
  const histogram = shape === 'histogram' ? explicitHistogram(p) : exponentialHistogram(p);
  return histogram ? { value: histogram.count, histogram } : null;
}

function kindOf(shape: Shape, points: Points): MetricPointInput['kind'] {
  if (shape === 'gauge') return 'gauge';
  if (shape === 'sum') return points.isMonotonic ? 'counter' : 'sum';
  return 'histogram';
}

function pointOf(
  ctx: Context,
  shape: Shape,
  points: Points,
  p: OtlpPoint,
): MetricPointInput | null {
  const parsed = valueOf(shape, p);
  if (!parsed) return null;
  const attributes = Object.fromEntries(Object.entries(attributesOf(p.attributes)).slice(0, 20));
  const start = p.startTimeUnixNano && String(p.startTimeUnixNano) !== '0';
  return {
    ts: nanosToDate(p.timeUnixNano),
    service: ctx.res.service,
    environment: ctx.res.environment,
    name: ctx.name,
    kind: kindOf(shape, points),
    unit: ctx.unit,
    value: parsed.value,
    attributes,
    scope: ctx.scope,
    seriesKey: seriesKeyOf({
      resource: ctx.res.attributes,
      scope: ctx.scope,
      name: ctx.name,
      attributes,
    }),
    startTs: start ? nanosToDate(p.startTimeUnixNano) : null,
    temporality: shape === 'gauge' ? null : temporalityOf(points.aggregationTemporality),
    monotonic: shape === 'sum' ? Boolean(points.isMonotonic) : shape === 'gauge' ? null : true,
    histogram: parsed.histogram,
  };
}

const SHAPES: Shape[] = ['gauge', 'sum', 'histogram', 'exponentialHistogram'];

function addMetric(batch: Batch, m: OtlpMetric, base: Omit<Context, 'name' | 'unit'>): void {
  const name = typeof m.name === 'string' ? m.name.slice(0, 200) : '';
  const shape = SHAPES.find((s) => m[s]);
  const points = shape ? m[shape]! : (m.summary ?? {});
  const total = points.dataPoints?.length ?? 0;
  batch.received += total;
  if (!name) return reject(batch, 'invalid_metric: metric has no name', total);
  if (!shape)
    return reject(batch, `unsupported_type: metric "${name}" is a summary or unknown type`, total);
  const ctx: Context = { ...base, name, unit: m.unit ? m.unit.slice(0, 40) : null };
  for (const p of points.dataPoints ?? []) {
    if (batch.points.length >= MAX_METRIC_POINTS) {
      reject(batch, `limit_exceeded: at most ${MAX_METRIC_POINTS} data points per request`);
      continue;
    }
    const point = pointOf(ctx, shape, points, p);
    if (point) batch.points.push(point);
    else reject(batch, `invalid_point: "${name}" has a non-finite value or malformed buckets`);
  }
}

export function metricsToBatch(req: MetricsRequest): Batch {
  const batch = emptyBatch('otlp');
  for (const rm of req.resourceMetrics ?? []) {
    const res = resourceInfo(rm.resource);
    const count = (rm.scopeMetrics ?? []).reduce((n, sm) => n + (sm.metrics?.length ?? 0), 0);
    if (count > 0)
      batch.metrics.push({ service: res.service, environment: res.environment, count });
    for (const sm of rm.scopeMetrics ?? []) {
      const scope = sm.scope?.name
        ? `${sm.scope.name}${sm.scope.version ? `@${sm.scope.version}` : ''}`.slice(0, 200)
        : null;
      for (const m of sm.metrics ?? []) addMetric(batch, m as OtlpMetric, { res, scope });
    }
  }
  return batch;
}

const REJECTED_FIELD = {
  traces: 'rejectedSpans',
  logs: 'rejectedLogRecords',
  metrics: 'rejectedDataPoints',
  errors: 'rejectedLogRecords',
} as const;

export function otlpPartialSuccess(
  signal: keyof typeof REJECTED_FIELD,
  batch: Batch,
): ({ errorMessage: string } & Partial<Record<string, number | string>>) | null {
  if (batch.rejected === 0) return null;
  return {
    [REJECTED_FIELD[signal]]: batch.rejected,
    errorMessage: `${batch.rejected} of ${batch.received} rejected: ${batch.rejectReason ?? 'invalid data'}`,
  };
}
