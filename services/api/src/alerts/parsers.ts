import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Severity } from '@ape/api-contracts';

// Source kinds live in @ape/api-contracts (ALERT_SOURCE_KINDS). `heartbeat` alerts are written
// by the platform itself when a ping is missed or resumes.
import { PermanentIngestError } from '../ingestion/normalize';

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
const MAX_LABELS = 50;

/** A primitive as text; objects and arrays count as missing. */
const prim = (v: unknown): string =>
  typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

/** Maps the many severity vocabularies (P1, critical, error, warning, info...) onto ours. */
export function mapSeverity(raw: unknown): Severity {
  const v = prim(raw).trim().toLowerCase();
  if (['critical', 'crit', 'fatal', 'emergency', 'p1', 'sev1', 'page', 'disaster'].includes(v))
    return 'critical';
  if (['high', 'error', 'err', 'major', 'p2', 'sev2', 'alert'].includes(v)) return 'high';
  if (['warning', 'warn', 'medium', 'moderate', 'p3', 'sev3', 'average'].includes(v))
    return 'medium';
  if (['info', 'information', 'low', 'minor', 'p4', 'p5', 'sev4', 'debug', 'ok'].includes(v))
    return 'low';
  return 'medium';
}

/** Keeps string-able values only, bounded, so labels are safe to show, filter and group on. */
function flatten(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_LABELS) break;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      out[k.slice(0, 100)] = String(v).slice(0, 500);
  }
  return out;
}

const date = (v: unknown, fallback: Date): Date => {
  if (typeof v !== 'string' && typeof v !== 'number') return fallback;
  const d = new Date(v);
  // Alertmanager uses 0001-01-01 for "not ended"; reject nonsense and far-future values.
  return Number.isNaN(d.getTime()) ||
    d.getFullYear() < 2000 ||
    d.getTime() > fallback.getTime() + 3600_000
    ? fallback
    : d;
};

const text = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

const url = (v: unknown): string | null => {
  const s = text(v, 2000);
  return s && /^https?:\/\//i.test(s) ? s : null;
};

const invalid = (message: string) => new PermanentIngestError('invalid_payload', message);

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

function parseSentry(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as {
    action?: string;
    data?: {
      issue?: Record<string, unknown>;
      event?: Record<string, unknown> & { tags?: [string, string][] };
      triggered_rule?: string;
    };
  };
  const issue = p?.data?.issue;
  const event = p?.data?.event;
  if (!issue && !event) throw invalid('Expected a Sentry webhook with data.issue or data.event');
  const tags = Object.fromEntries(
    (Array.isArray(event?.tags) ? event.tags : [])
      .filter((t): t is [string, string] => Array.isArray(t) && t.length === 2)
      .map(([k, v]) => [String(k), String(v)]),
  );
  const project = (issue?.project as { slug?: string } | undefined)?.slug ?? tags.project;
  const id = text(issue?.id, 100) ?? text(event?.issue_id, 100) ?? text(event?.event_id, 100);
  const title = text(issue?.title, 300) ?? text(event?.title, 300) ?? 'Sentry alert';
  return [
    {
      dedupKey: id ?? hash(title),
      status: p.action === 'resolved' || issue?.status === 'resolved' ? 'resolved' : 'firing',
      title,
      description: text(issue?.culprit, 2000) ?? text(event?.culprit, 2000),
      severity: mapSeverity(issue?.level ?? event?.level ?? 'error'),
      labels: flatten({
        ...tags,
        ...(project ? { project } : {}),
        ...(p.data?.triggered_rule ? { rule: p.data.triggered_rule } : {}),
      }),
      sourceUrl: url(issue?.web_url) ?? url(event?.web_url),
      occurredAt: date(event?.datetime ?? issue?.lastSeen, now),
    },
  ];
}

// ----- Datadog (webhook integration with the template on the setup page) -----

function parseDatadog(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as Record<string, unknown>;
  const title = text(p?.title, 300);
  if (!title) throw invalid('Expected a Datadog webhook body with at least `title`');
  const transition = prim(p.alert_transition ?? p.transition).toLowerCase();
  const tags = Object.fromEntries(
    prim(p.tags)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const i = t.indexOf(':');
        return i > 0 ? [t.slice(0, i), t.slice(i + 1)] : [t, 'true'];
      }),
  );
  return [
    {
      dedupKey: text(p.aggregate, 300) ?? text(p.alert_id, 300) ?? text(p.id, 300) ?? hash(title),
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
    case 'heartbeat':
      return parseHeartbeat(payload, now);
    default:
      throw new PermanentIngestError('unknown_source', `No alert parser for "${kind}"`);
  }
}
