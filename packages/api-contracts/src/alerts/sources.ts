import { z } from 'zod';
import {
  nameSchema,
  uuidSchema,
  type ConnectionStatus,
  type IsoTimestamp,
  type Uuid,
  type ValueOf,
  type WithSecret,
} from '../common';

export const WEBHOOK_ALERT_KINDS = [
  'http',
  'alertmanager',
  'grafana',
  'sentry',
  'datadog',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
] as const;
export const ALERT_SOURCE_KINDS = [
  ...WEBHOOK_ALERT_KINDS,
  'heartbeat',
  'monitor',
  'log_alert',
  'metric_alert',
] as const;
export type AlertSourceKind = ValueOf<typeof ALERT_SOURCE_KINDS>;

export const ALERT_SOURCE_LABELS: Record<AlertSourceKind, string> = {
  http: 'HTTP (JSON)',
  alertmanager: 'Prometheus Alertmanager',
  grafana: 'Grafana alerting',
  sentry: 'Sentry',
  datadog: 'Datadog',
  betterstack: 'Better Stack',
  cloudwatch: 'Amazon CloudWatch (SNS)',
  elasticsearch: 'Elasticsearch / Kibana',
  heartbeat: 'Heartbeat monitor',
  monitor: 'Uptime monitor',
  log_alert: 'Log alert',
  metric_alert: 'Metric alert',
};

const DAY_SECONDS = 24 * 3600;

const metadataSchema = z
  .record(z.string().trim().min(1).max(100), z.string().max(500))
  .refine((m) => Object.keys(m).length <= 20, { message: 'At most 20 metadata entries' });
const escalationPolicyIdSchema = uuidSchema.nullable();
const heartbeatTiming = {
  intervalSeconds: z
    .number()
    .int()
    .min(30)
    .max(31 * DAY_SECONDS),
  graceSeconds: z
    .number()
    .int()
    .min(0)
    .max(7 * DAY_SECONDS),
};

export const createAlertSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(WEBHOOK_ALERT_KINDS),
    name: nameSchema(80),
    escalationPolicyId: escalationPolicyIdSchema.optional(),
  }),
  z.object({
    kind: z.literal('heartbeat'),
    name: nameSchema(80),
    intervalSeconds: heartbeatTiming.intervalSeconds,
    graceSeconds: heartbeatTiming.graceSeconds.default(60),
    metadata: metadataSchema.default({}),
    escalationPolicyId: escalationPolicyIdSchema.optional(),
  }),
]);
export type CreateAlertSourceInput = z.input<typeof createAlertSourceSchema>;

export const updateAlertSourceSchema = z.object({
  name: nameSchema(80).optional(),
  escalationPolicyId: escalationPolicyIdSchema.optional(),
  intervalSeconds: heartbeatTiming.intervalSeconds.optional(),
  graceSeconds: heartbeatTiming.graceSeconds.optional(),
  metadata: metadataSchema.optional(),
  paused: z.boolean().optional(),
});
export type UpdateAlertSourceInput = z.infer<typeof updateAlertSourceSchema>;

export const HEARTBEAT_STATES = ['pending', 'up', 'late', 'down', 'paused'] as const;
export type HeartbeatState = ValueOf<typeof HEARTBEAT_STATES>;

export interface HeartbeatStatus {
  intervalSeconds: number;
  graceSeconds: number;
  state: HeartbeatState;
  paused: boolean;
  lastPingAt: IsoTimestamp | null;
  dueAt: IsoTimestamp | null;
  running: { executionId: string | null; startedAt: IsoTimestamp } | null;
  metadata: Record<string, string>;
}

export interface AlertSource {
  id: Uuid;
  kind: AlertSourceKind;
  name: string;
  status: ConnectionStatus;
  url: string;
  lastReceivedAt: IsoTimestamp | null;
  lastError: string | null;
  escalationPolicyId: Uuid | null;
  heartbeat: HeartbeatStatus | null;
  createdAt: IsoTimestamp;
}

export type AlertSourceWithToken = WithSecret<AlertSource, 'token'>;

export interface HeartbeatPingView {
  id: number;
  signal: 'success' | 'fail' | 'start';
  outcome: string;
  executionId: string | null;
  durationMs: number | null;
  body: string | null;
  receivedAt: IsoTimestamp;
}

export interface HeartbeatDetail {
  source: AlertSource;
  pingUrl: string | null;
  pings: HeartbeatPingView[];
}

export const RECEIPT_OUTCOMES = ['pending', 'processed', 'rejected'] as const;
export type ReceiptOutcome = ValueOf<typeof RECEIPT_OUTCOMES>;

export interface AlertReceiptView {
  id: Uuid;
  externalEventId: string;
  outcome: ReceiptOutcome;
  reason: string | null;
  attempts: number;
  duplicates: number;
  receivedAt: IsoTimestamp;
  processedAt: IsoTimestamp | null;
  payload: Record<string, unknown>;
}

export interface AlertIntakeReceipt {
  accepted: true;
  receiptId: Uuid | null;
  duplicate: boolean;
}
