import type { AlertCondition, AlertRoute, AlertSourceKind } from '@ape/api-contracts';

/** Example body for the generic JSON source, also the default "Test a payload" sample. */
export const SAMPLE_HTTP_ALERT = {
  title: 'Checkout error rate above 5%',
  status: 'firing',
  severity: 'high',
  dedup_key: 'checkout-error-rate',
  description: 'Error rate 7.2% over the last 5 minutes.',
  metadata: { service: 'checkout', env: 'production' },
};

/** Ready-to-paste setup for one tool, with this source's URL and token filled in. */
export function setupSnippet(kind: AlertSourceKind, url: string, token: string): string {
  const q = `${url}?token=${token}`;
  switch (kind) {
    case 'http':
      return [
        `curl -X POST '${url}' \\`,
        `  -H 'Authorization: Bearer ${token}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${JSON.stringify(SAMPLE_HTTP_ALERT)}'`,
        '',
        '# Send "status":"resolved" with the same dedup_key to resolve it.',
      ].join('\n');
    case 'alertmanager':
      return [
        '# alertmanager.yml',
        'receivers:',
        '  - name: ape',
        '    webhook_configs:',
        `      - url: '${url}'`,
        '        send_resolved: true',
        '        http_config:',
        '          authorization:',
        `            credentials: '${token}'`,
      ].join('\n');
    case 'grafana':
      return [
        'In Grafana: Alerting → Contact points → Add contact point.',
        `Integration: Webhook. URL: ${url}`,
        `Optional settings → Authorization header: scheme "Bearer", credentials: ${token}`,
        'Then add the contact point to a notification policy.',
      ].join('\n');
    case 'sentry':
      return [
        'In Sentry: Settings → Developer Settings → Custom Integrations → New Internal Integration.',
        `Webhook URL: ${q}`,
        'Turn on "Alert Rule Action", save, then pick this integration as the action in an issue alert rule.',
      ].join('\n');
    case 'datadog':
      return [
        'In Datadog: Integrations → Webhooks → New.',
        `Name: ape. URL: ${q}`,
        'Payload:',
        '{"id":"$ID","title":"$EVENT_TITLE","body":"$EVENT_MSG","alert_transition":"$ALERT_TRANSITION","alert_priority":"$ALERT_PRIORITY","aggregate":"$AGGREG_KEY","tags":"$TAGS","link":"$LINK","date":"$DATE"}',
        'Then add @webhook-ape to the monitors that should open incidents.',
      ].join('\n');
    case 'betterstack':
      return [
        'In Better Stack Uptime: Integrations → Webhook → Add.',
        `URL: ${q}`,
        'Choose the monitors or escalation policies that should notify it.',
      ].join('\n');
    case 'cloudwatch':
      return [
        'In AWS: SNS → Topics → your alarm topic → Create subscription.',
        `Protocol: HTTPS. Endpoint: ${q}`,
        "We confirm the subscription automatically. Point your alarms' ALARM and OK actions at that topic.",
      ].join('\n');
    case 'elasticsearch':
      return [
        `In Kibana: Stack Management → Connectors → Webhook. Method POST, URL: ${url}`,
        `Add header Authorization: Bearer ${token}`,
        'In each rule, add an action with this body (and one for Recovered with "status":"recovered"):',
        '{"rule_id":"{{rule.id}}","rule_name":"{{rule.name}}","alert_id":"{{alert.id}}","status":"{{alert.actionGroup}}","reason":"{{context.reason}}","tags":"{{rule.tags}}","url":"{{rule.url}}","date":"{{date}}"}',
      ].join('\n');
    case 'heartbeat':
      return [
        '# Ping at the end of each successful run, e.g. from cron:',
        `curl -fsS '${q}'`,
        '',
        '# A missed ping (interval + grace) fires an alert; the next ping resolves it.',
      ].join('\n');
  }
}

export const OP_LABELS: Record<AlertCondition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  regex: 'matches',
  exists: 'is set',
  not_exists: 'is not set',
};

/** "severity is critical and label.service contains checkout", or "every alert". */
export function describeConditions(conditions: AlertCondition[]): string {
  if (conditions.length === 0) return 'every alert';
  return conditions
    .map((c) =>
      c.op === 'exists' || c.op === 'not_exists'
        ? `${c.field} ${OP_LABELS[c.op]}`
        : `${c.field} ${OP_LABELS[c.op]} "${c.value ?? ''}"`,
    )
    .join(' and ');
}

/** Route ids after moving one up (-1) or down (+1); unchanged at either end. */
export function moveRoute(routes: Pick<AlertRoute, 'id'>[], index: number, by: -1 | 1): string[] {
  const ids = routes.map((r) => r.id);
  const to = index + by;
  if (index < 0 || index >= ids.length || to < 0 || to >= ids.length) return ids;
  [ids[index], ids[to]] = [ids[to]!, ids[index]!];
  return ids;
}

/** "a, b , ,c" → ["a", "b", "c"] for the group-by field. */
export function parseList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
