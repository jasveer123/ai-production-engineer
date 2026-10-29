import { z } from 'zod';
import {
  nameSchema,
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
export const ALERT_SOURCE_KINDS = [...WEBHOOK_ALERT_KINDS, 'heartbeat'] as const;
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
};

const DAY_SECONDS = 24 * 3600;

export const createAlertSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(WEBHOOK_ALERT_KINDS), name: nameSchema(80) }),
  z.object({
    kind: z.literal('heartbeat'),
    name: nameSchema(80),
    intervalSeconds: z
      .number()
      .int()
      .min(30)
      .max(7 * DAY_SECONDS),
    graceSeconds: z.number().int().min(0).max(DAY_SECONDS).default(60),
  }),
]);
export type CreateAlertSourceInput = z.input<typeof createAlertSourceSchema>;

export interface HeartbeatStatus {
  intervalSeconds: number;
  graceSeconds: number;
  state: 'pending' | 'up' | 'down';
  lastPingAt: IsoTimestamp | null;
}

export interface AlertSource {
  id: Uuid;
  kind: AlertSourceKind;
  name: string;
  status: ConnectionStatus;
  url: string;
  lastReceivedAt: IsoTimestamp | null;
  lastError: string | null;
  heartbeat: HeartbeatStatus | null;
  createdAt: IsoTimestamp;
}

export type AlertSourceWithToken = WithSecret<AlertSource, 'token'>;
