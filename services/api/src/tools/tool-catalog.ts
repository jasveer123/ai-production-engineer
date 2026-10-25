import type { AlertSourceKind, ToolId } from '@ape/api-contracts';

export interface ToolMeta {
  name: string;
  description: string;
  readsWhat: string;
  alertKind: AlertSourceKind;
  /** Setup text shown once when alerts are turned on. `{url}` and `{token}` are filled in. */
  alertSetup: string;
}

export const TOOL_CATALOG: Record<ToolId, ToolMeta> = {
  grafana: {
    name: 'Grafana',
    description: 'Alerts and Loki logs',
    readsWhat: 'Loki logs',
    alertKind: 'grafana',
    alertSetup: [
      'In Grafana: Alerting → Contact points → Add contact point.',
      'Integration: Webhook. URL: {url}',
      'Optional settings → Authorization header: scheme "Bearer", credentials: {token}',
      'Then add the contact point to a notification policy. Prometheus Alertmanager works the same way (webhook_configs with bearer_token).',
    ].join('\n'),
  },
  datadog: {
    name: 'Datadog',
    description: 'Monitors and log search',
    readsWhat: 'logs',
    alertKind: 'datadog',
    alertSetup: [
      'In Datadog: Integrations → Webhooks → New.',
      'Name: ape. URL: {url}?token={token}',
      'Payload:',
      '{"id":"$ID","title":"$EVENT_TITLE","body":"$EVENT_MSG","alert_transition":"$ALERT_TRANSITION","alert_priority":"$ALERT_PRIORITY","aggregate":"$AGGREG_KEY","tags":"$TAGS","link":"$LINK","date":"$DATE"}',
      'Then add @webhook-ape to the monitors that should open incidents.',
    ].join('\n'),
  },
  sentry: {
    name: 'Sentry',
    description: 'Errors and stack traces',
    readsWhat: 'errors',
    alertKind: 'sentry',
    alertSetup: [
      'In Sentry: Settings → Developer Settings → Custom Integrations → New Internal Integration.',
      'Webhook URL: {url}?token={token}',
      'Turn on "Alert Rule Action", save, then pick this integration as the action in an issue alert rule.',
    ].join('\n'),
  },
  betterstack: {
    name: 'Better Stack',
    description: 'Logs and uptime',
    readsWhat: 'logs',
    alertKind: 'betterstack',
    alertSetup: [
      'In Better Stack Uptime: Integrations → Webhook → Add.',
      'URL: {url}?token={token}',
      'Choose the monitors or escalation policies that should notify it.',
    ].join('\n'),
  },
  cloudwatch: {
    name: 'CloudWatch',
    description: 'AWS logs and alarms',
    readsWhat: 'logs',
    alertKind: 'cloudwatch',
    alertSetup: [
      'In AWS: SNS → Topics → your alarm topic → Create subscription.',
      'Protocol: HTTPS. Endpoint: {url}?token={token}',
      "We confirm the subscription automatically. Point your CloudWatch alarms' ALARM and OK actions at that topic.",
    ].join('\n'),
  },
  elasticsearch: {
    name: 'Elasticsearch',
    description: 'Self-hosted logs',
    readsWhat: 'logs',
    alertKind: 'elasticsearch',
    alertSetup: [
      'In Kibana: Stack Management → Connectors → Webhook. Method POST, URL: {url}',
      'Add header Authorization: Bearer {token}',
      'In each rule, add an action with this body (and one for the Recovered action group with "status":"recovered"):',
      '{"rule_id":"{{rule.id}}","rule_name":"{{rule.name}}","alert_id":"{{alert.id}}","status":"{{alert.actionGroup}}","reason":"{{context.reason}}","tags":"{{rule.tags}}","url":"{{rule.url}}","date":"{{date}}"}',
    ].join('\n'),
  },
};
