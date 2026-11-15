import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';
import { METRIC_AGGS } from './metrics';

export const METRIC_ALERT_TYPES = ['threshold', 'relative', 'anomaly'] as const;
export type MetricAlertType = (typeof METRIC_ALERT_TYPES)[number];
export const MISSING_DATA_POLICIES = ['alert', 'ok', 'keep'] as const;
export type MissingDataPolicy = (typeof MISSING_DATA_POLICIES)[number];
export const METRIC_ALERT_STATES = [
  'ok',
  'pending',
  'firing',
  'recovering',
  'no_data',
  'error',
] as const;
export type MetricAlertState = (typeof METRIC_ALERT_STATES)[number];

export const metricAlertQuerySchema = z.object({
  metric: z.string().trim().min(1).max(200),
  agg: z.enum(METRIC_AGGS),
  service: z.string().trim().min(1).max(120).optional(),
  groupBy: z.string().trim().min(1).max(100).optional(),
  filters: z.string().trim().max(500).optional(),
});
export type MetricAlertQuery = z.infer<typeof metricAlertQuerySchema>;

export const metricAlertConditionSchema = z.object({
  type: z.enum(METRIC_ALERT_TYPES),
  operator: z.enum(['above', 'below']),
  threshold: z.number().finite(),
});
export type MetricAlertCondition = z.infer<typeof metricAlertConditionSchema>;

export const createMetricAlertSchema = z.object({
  name: nameSchema(80),
  query: metricAlertQuerySchema,
  condition: metricAlertConditionSchema,
  windowMinutes: z.number().int().min(1).max(1440).default(5),
  everySeconds: z.number().int().min(30).max(3600).default(60),
  perSeries: z.boolean().default(false),
  confirmationSeconds: z.number().int().min(0).max(86_400).default(0),
  recoverySeconds: z.number().int().min(0).max(86_400).default(0),
  missingData: z.enum(MISSING_DATA_POLICIES).default('keep'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
  escalationPolicyId: z.string().uuid().nullable().optional(),
});
export type CreateMetricAlertInput = z.input<typeof createMetricAlertSchema>;

export const updateMetricAlertSchema = createMetricAlertSchema.partial().extend({
  paused: z.boolean().optional(),
});
export type UpdateMetricAlertInput = z.infer<typeof updateMetricAlertSchema>;

export interface MetricAlertSeriesState {
  series: string;
  state: MetricAlertState;
  since: IsoTimestamp;
  lastValue: number | null;
  observation: string | null;
}

export interface MetricAlertView {
  id: Uuid;
  name: string;
  query: MetricAlertQuery;
  condition: MetricAlertCondition;
  windowMinutes: number;
  everySeconds: number;
  perSeries: boolean;
  confirmationSeconds: number;
  recoverySeconds: number;
  missingData: MissingDataPolicy;
  severity: string;
  escalationPolicyId: Uuid | null;
  paused: boolean;
  state: MetricAlertState;
  series: MetricAlertSeriesState[];
  lastEvaluatedAt: IsoTimestamp | null;
  lastError: string | null;
  createdAt: IsoTimestamp;
}
