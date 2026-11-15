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

  key: string;
  occurredAt: string;
  summary: string;
  incident: IncidentSnapshot;
  url: string;
  note?: string;
}

const STATUS_EVENTS: Record<string, NotificationEvent> = {
  awaiting_review: 'review.requested',
  needs_attention: 'incident.needs_attention',
  resolved: 'incident.resolved',
  verification_inconclusive: 'verification.inconclusive',
};

export function notificationTypeFor(event: {
  kind: string;
  attributes: Record<string, unknown>;
}): NotificationEvent | null {
  if (event.kind === 'created') return 'incident.detected';
  if (event.kind !== 'status_change') return null;
  const to = event.attributes.to;
  return typeof to === 'string' ? (STATUS_EVENTS[to] ?? null) : null;
}

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

export function teamsMessage(n: Notification) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', weight: 'Bolder', size: 'Medium', text: headline(n), wrap: true },
            { type: 'TextBlock', text: n.incident.title.slice(0, 300), wrap: true },
            {
              type: 'TextBlock',
              isSubtle: true,
              wrap: true,
              text: `${n.incident.severity} · ${n.incident.status.replace(/_/g, ' ')}`,
            },
          ],
          actions: [{ type: 'Action.OpenUrl', title: 'Open incident', url: n.url }],
        },
      },
    ],
  };
}

export function emailMessage(n: Notification): { subject: string; text: string } {
  const i = n.incident;
  return {
    subject: `[${i.severity}] ${i.title}`.slice(0, 200),
    text: [
      headline(n),
      i.title,
      `Severity: ${i.severity}. Status: ${i.status.replace(/_/g, ' ')}.`,
      i.serviceName ? `Service: ${i.serviceName}${i.environment ? ` (${i.environment})` : ''}` : '',
      n.summary,
      '',
      `Open it: ${n.url}`,
      n.note ?? '',
    ]
      .filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== ''))
      .join('\n')
      .trim(),
  };
}

export const maskPhone = (phone: string) =>
  phone.length > 6 ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : '—';

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

export function testNotification(workspaceId: string, key: string, url: string): Notification {
  return {
    type: 'incident.detected',
    key,
    occurredAt: new Date().toISOString(),
    summary: 'This is a test notification from Pramaan. No incident is open.',
    url,
    incident: {
      id: key,
      workspaceId,
      title: 'Test notification',
      severity: 'low',
      status: 'detected',
      serviceName: null,
      environment: null,
    },
  };
}
