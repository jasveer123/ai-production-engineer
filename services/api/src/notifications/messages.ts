import { SEVERITIES, type NotificationEvent, type Severity } from '@ape/api-contracts';

export interface IncidentSnapshot {
  id: string;
  workspaceId: string;
  title: string;
  severity: Severity;
  status: string;
  serviceName: string | null;
  environment: string | null;
}

export interface Notification {
  type: NotificationEvent;
  /** Stable per event: a retried delivery of the same event reuses it. */
  key: string;
  occurredAt: string;
  summary: string;
  incident: IncidentSnapshot;
  url: string;
}

const STATUS_EVENTS: Record<string, NotificationEvent> = {
  awaiting_review: 'review.requested',
  needs_attention: 'incident.needs_attention',
  resolved: 'incident.resolved',
  verification_inconclusive: 'verification.inconclusive',
};

/** Which notification (if any) an incident timeline event produces. */
export function notificationTypeFor(event: {
  kind: string;
  attributes: Record<string, unknown>;
}): NotificationEvent | null {
  if (event.kind === 'created') return 'incident.detected';
  if (event.kind !== 'status_change') return null;
  const to = event.attributes.to;
  return typeof to === 'string' ? (STATUS_EVENTS[to] ?? null) : null;
}

/** critical > high > medium > low. */
export const severityAtLeast = (severity: Severity, min: Severity): boolean =>
  SEVERITIES.indexOf(severity) <= SEVERITIES.indexOf(min);

const where = (i: IncidentSnapshot) =>
  i.serviceName ? ` in ${i.serviceName}${i.environment ? ` (${i.environment})` : ''}` : '';

const HEADLINE: Record<NotificationEvent, (i: IncidentSnapshot) => string> = {
  'incident.detected': (i) => `New ${i.severity} incident${where(i)}`,
  'review.requested': (i) => `A validated fix is waiting for review${where(i)}`,
  'incident.needs_attention': (i) => `Incident needs attention${where(i)}`,
  'incident.resolved': (i) => `Incident resolved${where(i)}`,
  'verification.inconclusive': (i) => `Recovery could not be verified${where(i)}`,
};

export const headline = (n: Notification) => HEADLINE[n.type](n.incident);

/**
 * Slack mrkdwn treats `<...>` as links and mentions (e.g. `<!channel>`), so text that comes from
 * telemetry is escaped before it is posted.
 */
export const slackEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function slackMessage(n: Notification) {
  const title = slackEscape(n.incident.title.slice(0, 300));
  const summary = slackEscape(n.summary.slice(0, 500));
  const text = `${headline(n)}: ${title}`;
  return {
    text,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${slackEscape(headline(n))}*\n<${n.url}|${title}>` },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${n.incident.severity} · ${n.incident.status.replace(/_/g, ' ')} · ${summary}`,
          },
        ],
      },
    ],
  };
}

/** Body of a generic webhook delivery. Metadata only: no stack traces, code or evidence. */
export function webhookPayload(n: Notification) {
  return {
    id: n.key,
    type: n.type,
    occurredAt: n.occurredAt,
    summary: n.summary,
    headline: headline(n),
    incident: {
      id: n.incident.id,
      title: n.incident.title,
      severity: n.incident.severity,
      status: n.incident.status,
      service: n.incident.serviceName,
      environment: n.incident.environment,
      url: n.url,
    },
    workspaceId: n.incident.workspaceId,
  };
}

/** "https://hooks.slack.com/services/T0/B0/xyz" -> "hooks.slack.com/services/T0/…" */
export function maskTarget(kind: string, url: string): string {
  try {
    const u = new URL(url);
    if (kind === 'slack') {
      const [team] = u.pathname.replace('/services/', '').split('/');
      return `${u.host}/services/${team ?? ''}/…`;
    }
    return `${u.protocol}//${u.host}${u.pathname.length > 1 ? u.pathname : ''}`;
  } catch {
    return '—';
  }
}
