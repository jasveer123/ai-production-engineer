import { flatten, text, type ParsedAlert } from './parser-utils';

export function parseMetricAlert(payload: unknown, now: Date): ParsedAlert[] {
  const p = payload as {
    status?: string;
    name?: string;
    reason?: string;
    severity?: string;
    series?: string;
    labels?: unknown;
  };
  const name = text(p?.name, 200) ?? 'metric alert';
  const series = text(p?.series, 300) ?? '*';
  const firing = p?.status !== 'resolved';
  const severity = ['low', 'medium', 'high', 'critical'].includes(p?.severity ?? '')
    ? (p.severity as ParsedAlert['severity'])
    : 'high';
  const suffix = series === '*' ? '' : ` (${series})`;
  return [
    {
      dedupKey: `metric_alert:${series}`,
      status: firing ? 'firing' : 'resolved',
      title: `Metric alert "${name}"${suffix} ${firing ? 'is firing' : 'recovered'}`,
      description: text(p?.reason, 500),
      severity,
      labels: { alert: name, ...flatten(p?.labels) },
      sourceUrl: null,
      occurredAt: now,
    },
  ];
}
