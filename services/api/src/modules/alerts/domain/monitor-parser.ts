import { flatten, text, type ParsedAlert } from './parser-utils';

interface MonitorPayload {
  status?: string;
  name?: string;
  target?: string;
  reason?: string;
  alertKey?: string;
  title?: string;
  metadata?: unknown;
  monitorId?: string;
}

function monitorLabels(p: MonitorPayload, name: string): Record<string, string> {
  const labels: Record<string, string> = { ...flatten(p.metadata), monitor: name };
  const id = text(p.monitorId, 64);
  const target = text(p.target, 300);
  if (id) labels.monitor_id = id;
  if (target) labels.target = target;
  return labels;
}

export function parseMonitor(payload: unknown, now: Date): ParsedAlert[] {
  const p = (payload ?? {}) as MonitorPayload;
  const name = text(p.name, 200) ?? 'monitor';
  const firing = p.status !== 'resolved';
  return [
    {
      dedupKey: text(p.alertKey, 80) ?? 'monitor',
      status: firing ? 'firing' : 'resolved',
      title: text(p.title, 300) ?? `Monitor "${name}" is ${firing ? 'down' : 'back up'}`,
      description: text(p.reason, 500),
      severity: 'high',
      labels: monitorLabels(p, name),
      sourceUrl: null,
      occurredAt: now,
    },
  ];
}
