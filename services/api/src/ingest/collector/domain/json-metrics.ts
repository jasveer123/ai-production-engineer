import { z } from 'zod';
import { lenientRecords, type Defaults } from './formats';
import { seriesKeyOf } from './otlp-metrics';
import {
  DEFAULT_ENVIRONMENT,
  DEFAULT_SERVICE,
  emptyBatch,
  parseDate,
  reject,
  type Batch,
} from './types';

const MAX_POINTS = 5000;

const pointSchema = z.object({
  name: z.string().trim().min(1).max(200),
  value: z.number().finite(),
  kind: z.enum(['gauge', 'counter', 'sum']).default('gauge'),
  unit: z.string().max(40).nullish(),
  service: z.string().max(100).nullish(),
  environment: z.string().max(40).nullish(),
  labels: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  temporality: z.enum(['cumulative', 'delta']).nullish(),
});

const TIME_KEYS = ['dt', 'timestamp', 'ts', 'time'];

export function jsonMetricsToBatch(body: string, defaults: Defaults = {}): Batch {
  const batch = emptyBatch('http');
  for (const { index, rec } of lenientRecords(batch, body)) {
    const parsed = pointSchema.safeParse({ ...rec, labels: rec.labels ?? rec.attributes });
    if (!parsed.success) {
      reject(batch, `invalid_point: ${parsed.error.issues[0]?.path.join('.') ?? 'body'}`, 1, index);
      continue;
    }
    if (batch.points.length >= MAX_POINTS) {
      reject(batch, 'limit_exceeded', 1, index);
      continue;
    }
    const p = parsed.data;
    const time = TIME_KEYS.map((k) => rec[k]).find((v) => v !== undefined);
    const attributes = Object.fromEntries(Object.entries(p.labels).slice(0, 20));
    const counter = p.kind === 'counter';
    batch.points.push({
      ts: parseDate(time),
      service: (p.service ?? defaults.service ?? DEFAULT_SERVICE).slice(0, 100),
      environment: (p.environment ?? defaults.environment ?? DEFAULT_ENVIRONMENT).slice(0, 40),
      name: p.name,
      kind: p.kind,
      unit: p.unit ?? null,
      value: p.value,
      attributes,
      seriesKey: seriesKeyOf({
        resource: { service: p.service ?? defaults.service ?? null },
        scope: null,
        name: p.name,
        attributes,
      }),
      temporality: p.kind === 'gauge' ? null : (p.temporality ?? 'cumulative'),
      monotonic: counter ? true : p.kind === 'sum' ? false : null,
    });
  }
  return batch;
}
