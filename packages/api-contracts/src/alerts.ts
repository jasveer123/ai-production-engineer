import { z } from 'zod';
import { Severity, severitySchema } from './incidents';

export const ALERT_SOURCE_KINDS = [
  'http',
  'alertmanager',
  'grafana',
  'sentry',
  'datadog',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
  'heartbeat',
] as const;
export type AlertSourceKind = (typeof ALERT_SOURCE_KINDS)[number];

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

export const createAlertSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum([
      'http',
      'alertmanager',
      'grafana',
      'sentry',
      'datadog',
      'betterstack',
      'cloudwatch',
      'elasticsearch',
    ]),
    name: z.string().trim().min(1).max(80),
  }),
  z.object({
    kind: z.literal('heartbeat'),
    name: z.string().trim().min(1).max(80),
    /** Expected time between pings. */
    intervalSeconds: z
      .number()
      .int()
      .min(30)
      .max(7 * 24 * 3600),
    /** Extra time allowed before the heartbeat counts as missed. */
    graceSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 3600)
      .default(60),
  }),
]);
export type CreateAlertSourceInput = z.input<typeof createAlertSourceSchema>;

export interface AlertSource {
  id: string;
  kind: AlertSourceKind;
  name: string;
  status: 'pending' | 'connected' | 'error' | 'disconnected';
  /** Where the tool sends alerts (or pings, for heartbeats). Authenticate with the token. */
  url: string;
  lastReceivedAt: string | null;
  lastError: string | null;
  heartbeat: {
    intervalSeconds: number;
    graceSeconds: number;
    state: 'pending' | 'up' | 'down';
    lastPingAt: string | null;
  } | null;
  createdAt: string;
}

/** Returned once on creation or rotation. Send as `Authorization: Bearer <token>` or `?token=`. */
export interface AlertSourceWithToken extends AlertSource {
  token: string;
}

export const ALERT_CONDITION_OPS = [
  'eq',
  'neq',
  'contains',
  'not_contains',
  'regex',
  'exists',
  'not_exists',
] as const;

export const alertConditionSchema = z
  .object({
    field: z
      .string()
      .regex(
        /^(title|description|severity|status|label\.[A-Za-z0-9_.\-/]{1,100})$/,
        'Use title, description, severity, status or label.<name>',
      ),
    op: z.enum(ALERT_CONDITION_OPS),
    value: z.string().max(200).optional(),
  })
  .refine((c) => c.op === 'exists' || c.op === 'not_exists' || c.value !== undefined, {
    message: 'This operator needs a value',
  })
  .refine(
    (c) => {
      if (c.op !== 'regex') return true;
      try {
        new RegExp(c.value ?? '');
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Not a valid regular expression' },
  );
export type AlertCondition = z.infer<typeof alertConditionSchema>;

export const alertRouteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  sourceIds: z.array(z.string().uuid()).max(50).default([]),
  conditions: z.array(alertConditionSchema).max(20).default([]),
  groupBy: z.array(z.string().trim().min(1).max(100)).max(5).default([]),
  createIncident: z.boolean().default(true),
  incidentSeverity: severitySchema.nullable().default(null),
});
export type AlertRouteInput = z.input<typeof alertRouteSchema>;
export const updateAlertRouteSchema = alertRouteSchema.partial();
export const reorderAlertRoutesSchema = z.object({ ids: z.array(z.string().uuid()).max(200) });

export interface AlertRoute {
  id: string;
  name: string;
  position: number;
  enabled: boolean;
  sourceIds: string[];
  conditions: AlertCondition[];
  groupBy: string[];
  createIncident: boolean;
  incidentSeverity: Severity | null;
  createdAt: string;
}

export const alertPreviewSchema = z.object({
  sourceId: z.string().uuid(),
  payload: z.unknown(),
});

/** Dry run of a payload: what would be parsed and where each alert would go. */
export interface AlertPreview {
  alerts: {
    title: string;
    status: 'firing' | 'resolved';
    severity: Severity;
    dedupKey: string;
    labels: Record<string, string>;
    route: { id: string; name: string } | null;
    groupKey: string | null;
    createsIncident: boolean;
  }[];
  error: string | null;
}

export interface AlertView {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKind: AlertSourceKind;
  routeId: string | null;
  routeName: string | null;
  incidentId: string | null;
  incidentTitle: string | null;
  status: 'firing' | 'resolved';
  title: string;
  description: string | null;
  severity: Severity;
  labels: Record<string, string>;
  sourceUrl: string | null;
  occurrences: number;
  firstFiredAt: string;
  lastFiredAt: string;
  resolvedAt: string | null;
}

export const alertListQuerySchema = z.object({
  status: z.enum(['firing', 'resolved']).optional(),
  sourceId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type AlertListQuery = z.input<typeof alertListQuerySchema>;
