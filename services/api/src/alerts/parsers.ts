import { z } from 'zod';
import type { Severity } from '@ape/api-contracts';

// Source kinds live in @ape/api-contracts (ALERT_SOURCE_KINDS). `heartbeat` alerts are written
// by the platform itself when a ping is missed or resumes.
import { PermanentIngestError } from '../ingestion/normalize';
import {
  date,
  firstDefined,
  firstText,
  flatten,
  hash,
  invalid,
  mapSeverity,
  pick,
  prim,
  splitTags,
  tagLabels,
  text,
  url,
} from './parser-utils';

export { mapSeverity };

/** One alert, whatever tool sent it. A single request may carry several (Alertmanager batches). */
export interface ParsedAlert {
  dedupKey: string;
  status: 'firing' | 'resolved';
  title: string;
  description: string | null;
  severity: Severity;
  labels: Record<string, string>;
  sourceUrl: string | null;
  occurredAt: Date;
}

const MAX_ALERTS_PER_REQUEST = 100;

// ----- Generic HTTP: the format documented on the source's setup page -----

const httpSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(10_000).optional(),
  status: z.enum(['firing', 'resolved']).default('firing'),
  dedup_key: z.string().trim().min(1).max(300).optional(),
  severity: z.string().max(40).optional(),
  source_url: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
  occurred_at: z.string().optional(),
});

function parseHttp(payload: unknown, now: Date): ParsedAlert[] {
  const p = httpSchema.safeParse(payload);
  if (!p.success)
    throw invalid(p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const a = p.data;
  return [
    {
      dedupKey: a.dedup_key ?? hash(a.title),
      status: a.status,
      title: a.title,
      description: a.description ?? null,
      severity: mapSeverity(a.severity),
      labels: flatten(a.metadata),
      sourceUrl: url(a.source_url),
      occurredAt: date(a.occurred_at, now),
    },
  ];
}

// ----- Prometheus Alertmanager and Grafana unified alerting (same webhook shape) -----

const amAlert = z.object({
  status: z.string(),
  labels: z.record(z.unknown()).default({}),
  annotations: z.record(z.unknown()).default({}),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  generatorURL: z.string().optional(),
  fingerprint: z.string().optional(),
  // Grafana extras
  dashboardURL: z.string().optional(),
  panelURL: z.string().optional(),
  silenceURL: z.string().optional(),
  valueString: z.string().optional(),
});
const amSchema = z.object({ alerts: z.array(amAlert).min(1) });

function parseAlertmanager(payload: unknown, now: Date): ParsedAlert[] {
  const p = amSchema.safeParse(payload);
  if (!p.success)
    throw invalid('Expected an Alertmanager/Grafana webhook body with an `alerts` array');
  return p.data.alerts.slice(0, MAX_ALERTS_PER_REQUEST).map((a) => {
    const labels = flatten(a.labels);
    const ann = flatten(a.annotations);
    const sorted = Object.keys(labels)
      .sort()
      .map((k) => `${k}=${labels[k]}`)
      .join(',');
    const resolved = a.status === 'resolved';
    return {
      dedupKey: a.fingerprint ?? hash(sorted),
      status: resolved ? 'resolved' : 'firing',
      title: (ann.summary ?? labels.alertname ?? 'Alert').slice(0, 300),
      description: ann.description ?? (a.valueString ? `Value: ${a.valueString}` : null),
      severity: mapSeverity(labels.severity ?? labels.priority),
      labels,
      sourceUrl: url(a.panelURL) ?? url(a.dashboardURL) ?? url(a.generatorURL),
      occurredAt: date(resolved ? a.endsAt : a.startsAt, now),
    };
  });
}

// ----- Sentry (issue alerts and event/metric alert webhooks) -----

interface SentryData {
  issue?: Record<string, unknown>;
  event?: Record<string, unknown> & { tags?: [string, string][] };
  triggered_rule?: string;
  // Metric alerts from the Sentry app: { action, data: { metric_alert, description_title } }.
  metric_alert?: Record<string, unknown>;
  description_title?: string;
  web_url?: string;
}
interface SentryPayload {
  action?: string;
  data?: SentryData;
}

const metricSeverity = (action?: string): Severity =>
  action === 'critical' ? 'critical' : action === 'warning' ? 'medium' : 'high';

function sentryMetricAlert(p: SentryPayload, data: SentryData, now: Date): ParsedAlert {
  const metric = data.metric_alert!;
  const title = firstText(300, data.description_title, metric.title) ?? 'Sentry metric alert';
  return {
    dedupKey: prim(metric.id) || hash(title),
    status: p.action === 'resolved' ? 'resolved' : 'firing',
    title,
    description: null,
    severity: metricSeverity(p.action),
    labels: {},
    sourceUrl: url(data.web_url),
    occurredAt: now,
  };
}

function sentryEventTags(event: SentryData['event']): Record<string, string> {
  return Object.fromEntries(
    (Array.isArray(event?.tags) ? event.tags : [])
      .filter((t): t is [string, string] => Array.isArray(t) && t.length === 2)
      .map(([k, v]) => [String(k), String(v)]),
  );
}

function sentryLabels(data: SentryData, tags: Record<string, string>): Record<string, string> {
  const project = (data.issue?.project as { slug?: string } | undefined)?.slug ?? tags.project;
  return flatten({
    ...tags,
    ...(project ? { project } : {}),
    ...(data.triggered_rule ? { rule: data.triggered_rule } : {}),
  });
}

function sentryIssueAlert(p: SentryPayload, data: SentryData, now: Date): ParsedAlert {
  const { issue, event } = data;
  // The same field can sit on the issue or on the event; the issue wins.
  const both = (key: string) => [issue?.[key], event?.[key]];
  const title = firstText(300, ...both('title')) ?? 'Sentry alert';
  return {
    dedupKey: firstText(100, issue?.id, event?.issue_id, event?.event_id) ?? hash(title),
    status: p.action === 'resolved' || issue?.status === 'resolved' ? 'resolved' : 'firing',
    title,
    description: firstText(2000, ...both('culprit')),
    severity: mapSeverity(firstDefined(both('level')) ?? 'error'),
    labels: sentryLabels(data, sentryEventTags(event)),
    sourceUrl: both('web_url').map(url).find(Boolean) ?? null,
    occurredAt: date(firstDefined([event?.datetime, issue?.lastSeen]), now),
  };
}

function parseSentry(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as SentryPayload;
  const data = p?.data;
  if (!data?.issue && !data?.event && data?.metric_alert) return [sentryMetricAlert(p, data, now)];
  if (!data?.issue && !data?.event)
    throw invalid('Expected a Sentry webhook with data.issue or data.event');
  return [sentryIssueAlert(p, data, now)];
}

// ----- Datadog (webhook integration with the template on the setup page) -----

function parseDatadog(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as Record<string, unknown>;
  const title = text(p?.title, 300);
  if (!title) throw invalid('Expected a Datadog webhook body with at least `title`');
  const transition = prim(p.alert_transition ?? p.transition).toLowerCase();
  const tags = tagLabels(splitTags(p.tags));
  return [
    {
      dedupKey: firstText(300, p.aggregate, p.alert_id, p.id) ?? hash(title),
      status: ['recovered', 'resolved', 'ok'].includes(transition) ? 'resolved' : 'firing',
      title,
      description: text(p.body, 10_000),
      severity: mapSeverity(p.alert_priority ?? p.priority ?? p.alert_type),
      labels: flatten(tags),
      sourceUrl: url(p.link) ?? url(p.url),
      // `date` is epoch seconds or milliseconds depending on the template.
      occurredAt: date(typeof p.date === 'number' && p.date < 1e11 ? p.date * 1000 : p.date, now),
    },
  ];
}

// ----- Better Stack Uptime (incident webhooks) -----

function parseBetterStack(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as {
    data?: { id?: unknown; type?: string; attributes?: Record<string, unknown> };
  };
  const a = p?.data?.attributes;
  if (!a) throw invalid('Expected a Better Stack webhook with data.attributes');
  const name = text(a.name, 300) ?? text(a.url, 300) ?? 'Better Stack incident';
  const cause = text(a.cause, 2000);
  const resolved = Boolean(a.resolved_at) || prim(a.status).toLowerCase() === 'resolved';
  return [
    {
      dedupKey: prim(p.data?.id) || hash(name),
      status: resolved ? 'resolved' : 'firing',
      title: cause ? `${name}: ${cause}`.slice(0, 300) : name,
      description: cause,
      severity: mapSeverity(a.severity ?? 'high'),
      labels: flatten({ url: a.url, monitor: a.monitor_id ?? a.name, team: a.team_name }),
      sourceUrl: url(a.incident_url) ?? url(a.url),
      occurredAt: date(resolved ? a.resolved_at : a.started_at, now),
    },
  ];
}

// ----- Amazon CloudWatch alarms delivered through SNS -----

/** The alarm itself, whether SNS-wrapped (Message is JSON text) or already unwrapped. */
function cloudWatchAlarm(env: { Message?: unknown } | null | undefined) {
  if (typeof env?.Message === 'string') {
    try {
      return JSON.parse(env.Message) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  // Already unwrapped (EventBridge or raw delivery).
  if (env && typeof env === 'object' && 'AlarmName' in env) return env as Record<string, unknown>;
  return null;
}

function alarmConsoleUrl(alarmArn: unknown, name: string): string | null {
  const region = /^arn:aws[\w-]*:cloudwatch:([a-z0-9-]+):/.exec(prim(alarmArn))?.[1];
  return region
    ? `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encodeURIComponent(name)}`
    : null;
}

function parseCloudWatch(payload: unknown, now: Date): ParsedAlert[] {
  const msg = cloudWatchAlarm(payload as { Message?: unknown });
  if (!msg || !text(msg.AlarmName, 300))
    throw invalid('Expected an SNS notification whose Message is a CloudWatch alarm');
  const name = text(msg.AlarmName, 300)!;
  const state = prim(msg.NewStateValue).toUpperCase();
  const trigger = (msg.Trigger ?? {}) as {
    MetricName?: string;
    Namespace?: string;
    Dimensions?: { name?: string; value?: string }[];
  };
  const dims = Object.fromEntries(
    (trigger.Dimensions ?? []).map((d) => [String(d.name), String(d.value)]),
  );
  return [
    {
      dedupKey: text(msg.AlarmArn, 300) ?? hash(name),
      status: state === 'OK' ? 'resolved' : 'firing',
      title: name,
      description:
        [text(msg.AlarmDescription, 2000), text(msg.NewStateReason, 4000)]
          .filter(Boolean)
          .join('\n\n') || null,
      severity: state === 'INSUFFICIENT_DATA' ? 'low' : mapSeverity(dims.severity ?? 'high'),
      labels: flatten({
        ...dims,
        state,
        metric: trigger.MetricName,
        namespace: trigger.Namespace,
        region: text(msg.Region, 100),
      }),
      sourceUrl: alarmConsoleUrl(msg.AlarmArn, name),
      occurredAt: date(msg.StateChangeTime, now),
    },
  ];
}

// ----- Elasticsearch / Kibana rules (webhook connector with the template on the setup page) -----

function parseElasticsearch(payload: unknown, now: Date): ParsedAlert[] {
  const p = (payload ?? {}) as Record<string, unknown>;
  const title = text(pick(p, 'rule_name', 'title', 'name'), 300);
  if (!title) throw invalid('Expected a Kibana webhook body with at least `rule_name`');
  const status = prim(pick(p, 'status', 'action_group')).toLowerCase();
  const tags = Array.isArray(p.tags) ? p.tags.map(String) : splitTags(p.tags);
  return [
    {
      dedupKey:
        [text(p.rule_id, 200), text(p.alert_id, 200)].filter(Boolean).join(':') || hash(title),
      status: ['recovered', 'resolved', 'ok', 'inactive'].includes(status) ? 'resolved' : 'firing',
      title,
      description: text(pick(p, 'reason', 'message'), 10_000),
      severity: mapSeverity(p.severity ?? 'high'),
      labels: flatten({
        ...tagLabels(tags),
        ...(p.service ? { service: p.service } : {}),
        ...(p.environment ? { environment: p.environment } : {}),
      }),
      sourceUrl: url(pick(p, 'url', 'rule_url')),
      occurredAt: date(pick(p, 'date', 'timestamp'), now),
    },
  ];
}

// ----- Heartbeat (written by the platform when a ping is missed or resumes) -----

function parseHeartbeat(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as { status?: string; name?: string; lastPingAt?: string | null };
  const name = text(p?.name, 200) ?? 'heartbeat';
  const firing = p?.status !== 'resolved';
  return [
    {
      dedupKey: 'heartbeat',
      status: firing ? 'firing' : 'resolved',
      title: `Heartbeat "${name}" ${firing ? 'missed' : 'resumed'}`,
      description: p?.lastPingAt
        ? `Last ping at ${p.lastPingAt}.`
        : 'No ping has been received yet.',
      severity: 'high',
      labels: { heartbeat: name },
      sourceUrl: null,
      occurredAt: now,
    },
  ];
}

export function parseAlerts(kind: string, payload: unknown, now = new Date()): ParsedAlert[] {
  switch (kind) {
    case 'http':
      return parseHttp(payload, now);
    case 'alertmanager':
    case 'grafana':
      return parseAlertmanager(payload, now);
    case 'sentry':
      return parseSentry(payload, now);
    case 'datadog':
      return parseDatadog(payload, now);
    case 'betterstack':
      return parseBetterStack(payload, now);
    case 'cloudwatch':
      return parseCloudWatch(payload, now);
    case 'elasticsearch':
      return parseElasticsearch(payload, now);
    case 'heartbeat':
      return parseHeartbeat(payload, now);
    default:
      throw new PermanentIngestError('unknown_source', `No alert parser for "${kind}"`);
  }
}
