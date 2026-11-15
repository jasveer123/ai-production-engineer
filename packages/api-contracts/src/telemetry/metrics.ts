import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';

export const METRIC_AGGS = [
  'avg',
  'max',
  'min',
  'sum',
  'count',
  'rate',
  'increase',
  'p50',
  'p90',
  'p95',
  'p99',
] as const;
export type MetricAgg = (typeof METRIC_AGGS)[number];
export const METRIC_KINDS = ['gauge', 'counter', 'sum', 'histogram'] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];
export const MAX_WIDGETS = 24;
export const CHART_TYPES = ['line', 'area', 'bar', 'stat', 'table'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export const metricQuerySchema = z.object({
  name: z.string().trim().min(1).max(200),
  agg: z.enum(METRIC_AGGS).default('avg'),
  minutes: z.coerce.number().int().min(5).max(10_080).default(60),
  service: z.string().trim().min(1).max(120).optional(),
  groupBy: z.string().trim().min(1).max(100).optional(),
  filters: z.string().trim().max(500).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type MetricQuery = z.input<typeof metricQuerySchema>;

export const widgetSchema = z.object({
  id: z.string().min(1).max(40),
  title: nameSchema(80),
  metric: z.string().trim().min(1).max(200),
  agg: z.enum(METRIC_AGGS),
  service: z.string().trim().min(1).max(120).optional(),
  groupBy: z.string().trim().min(1).max(100).optional(),
  filters: z.string().trim().max(500).optional(),
  chart: z.enum(CHART_TYPES).default('line'),
});
export type DashboardWidget = z.infer<typeof widgetSchema>;

export const dashboardVariableSchema = z.object({
  key: z.string().trim().min(1).max(100),
  label: z.string().trim().max(60).optional(),
});
export type DashboardVariable = z.infer<typeof dashboardVariableSchema>;

export const createDashboardSchema = z.object({
  name: nameSchema(80),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS).default([]),
  variables: z.array(dashboardVariableSchema).max(10).default([]),
});
export type CreateDashboardInput = z.input<typeof createDashboardSchema>;

export const updateDashboardSchema = z.object({
  name: nameSchema(80).optional(),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS).optional(),
  variables: z.array(dashboardVariableSchema).max(10).optional(),
});
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;

export interface MetricName {
  name: string;
  kind: MetricKind;
  unit: string | null;
  services: string[];
  points: number;
  lastAt: IsoTimestamp;
}

export interface MetricBucket {
  at: IsoTimestamp;
  value: number | null;
}

export interface MetricSeries {
  name: string;
  agg: MetricAgg;
  unit: string | null;
  buckets: MetricBucket[];
  groups?: { key: string; buckets: MetricBucket[] }[];
  truncated?: boolean;
}

export interface MetricLabelKey {
  key: string;
  values: string[];
}

export interface DashboardView {
  id: Uuid;
  name: string;
  widgets: DashboardWidget[];
  variables: DashboardVariable[];
  createdAt: IsoTimestamp;
}
