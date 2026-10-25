import type { ToolId } from '@ape/api-contracts';

export type ToolField = {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'url' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** Comma-separated input sent as an array. */
  list?: boolean;
};

/** What each tool needs for read-only access (Way 7). Secrets are password fields. */
export const TOOL_FIELDS: Record<ToolId, { help: string; fields: ToolField[] }> = {
  grafana: {
    help: 'A Grafana service account token with the Viewer role, or Grafana Cloud Loki credentials (user id + API key, basic auth).',
    fields: [
      {
        name: 'url',
        label: 'Loki URL',
        type: 'url',
        placeholder: 'https://logs-prod-012.grafana.net',
        required: true,
        hint: 'Or https://grafana.example.com/api/datasources/proxy/uid/<loki-uid>',
      },
      {
        name: 'auth',
        label: 'Authentication',
        type: 'select',
        options: [
          { value: 'bearer', label: 'Bearer token' },
          { value: 'basic', label: 'Basic (user + key)' },
        ],
      },
      { name: 'username', label: 'User (basic only)', placeholder: '123456' },
      { name: 'token', label: 'Token or API key', type: 'password', required: true },
      { name: 'orgId', label: 'Tenant / X-Scope-OrgID (optional)' },
      { name: 'serviceLabel', label: 'Label with the service name', placeholder: 'service_name' },
    ],
  },
  datadog: {
    help: 'An API key plus an application key scoped to logs_read_data.',
    fields: [
      {
        name: 'site',
        label: 'Datadog site',
        type: 'select',
        options: [
          'datadoghq.com',
          'us3.datadoghq.com',
          'us5.datadoghq.com',
          'datadoghq.eu',
          'ap1.datadoghq.com',
          'ddog-gov.com',
        ].map((v) => ({ value: v, label: v })),
      },
      { name: 'apiKey', label: 'API key', type: 'password', required: true },
      {
        name: 'appKey',
        label: 'Application key',
        type: 'password',
        required: true,
        hint: 'Scope: logs_read_data only.',
      },
    ],
  },
  sentry: {
    help: 'An internal integration or user auth token with event:read and project:read.',
    fields: [
      { name: 'url', label: 'Sentry URL', type: 'url', placeholder: 'https://sentry.io' },
      { name: 'organization', label: 'Organization slug', required: true },
      { name: 'token', label: 'Auth token', type: 'password', required: true },
    ],
  },
  betterstack: {
    help: 'Telemetry → your source → Connect remotely: the ClickHouse HTTP endpoint, username, password and table.',
    fields: [
      {
        name: 'url',
        label: 'Connect remotely endpoint',
        type: 'url',
        placeholder: 'https://eu-nbg-2-connect.betterstackdata.com',
        required: true,
      },
      { name: 'username', label: 'Username', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true },
      { name: 'table', label: 'Source table', placeholder: 't123456_myapp_logs', required: true },
    ],
  },
  cloudwatch: {
    help: 'An IAM user with only logs:FilterLogEvents on the log groups below.',
    fields: [
      { name: 'region', label: 'Region', placeholder: 'eu-west-1', required: true },
      { name: 'accessKeyId', label: 'Access key id', required: true },
      { name: 'secretAccessKey', label: 'Secret access key', type: 'password', required: true },
      {
        name: 'logGroups',
        label: 'Log groups',
        placeholder: '/ecs/checkout-api, /aws/lambda/orders',
        required: true,
        list: true,
        hint: 'Comma separated, up to 5 are searched.',
      },
    ],
  },
  elasticsearch: {
    help: 'An API key with read on your log indices (or a read-only user with basic auth).',
    fields: [
      {
        name: 'url',
        label: 'Elasticsearch URL',
        type: 'url',
        placeholder: 'https://es.example.com:9200',
        required: true,
      },
      {
        name: 'auth',
        label: 'Authentication',
        type: 'select',
        options: [
          { value: 'apikey', label: 'API key' },
          { value: 'basic', label: 'Basic (user + password)' },
        ],
      },
      { name: 'username', label: 'User (basic only)' },
      { name: 'token', label: 'API key or password', type: 'password', required: true },
      { name: 'index', label: 'Index pattern', placeholder: 'logs-*' },
      { name: 'serviceField', label: 'Field with the service name', placeholder: 'service.name' },
    ],
  },
};

/** Form values to the API body: empty optional fields are left out, lists are split. */
export function readerBody(tool: ToolId, form: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of TOOL_FIELDS[tool].fields) {
    const raw = String(form.get(f.name) ?? '').trim();
    if (!raw) continue;
    body[f.name] = f.list
      ? raw
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : raw;
  }
  return body;
}
