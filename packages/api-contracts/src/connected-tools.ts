import { z } from 'zod';

export const TOOL_IDS = [
  'grafana',
  'datadog',
  'sentry',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

const httpsUrl = z.string().trim().url().max(500);
const secret = z.string().trim().min(1).max(4000);

/** Read-only credentials per tool. Secrets are stored encrypted and never returned. */
export const connectReaderSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    /** Loki base URL, or Grafana URL + datasource proxy path. */
    url: httpsUrl,
    auth: z.enum(['bearer', 'basic']).default('bearer'),
    username: z.string().trim().max(200).optional(),
    token: secret,
    orgId: z.string().trim().max(100).optional(),
    /** Label that holds the service name, e.g. `service_name` or `app`. */
    serviceLabel: z.string().trim().min(1).max(100).default('service_name'),
  }),
  z.object({
    tool: z.literal('datadog'),
    site: z
      .enum([
        'datadoghq.com',
        'us3.datadoghq.com',
        'us5.datadoghq.com',
        'datadoghq.eu',
        'ap1.datadoghq.com',
        'ddog-gov.com',
      ])
      .default('datadoghq.com'),
    apiKey: secret,
    appKey: secret,
  }),
  z.object({
    tool: z.literal('sentry'),
    url: httpsUrl.default('https://sentry.io'),
    organization: z.string().trim().min(1).max(100),
    token: secret,
  }),
  z.object({
    tool: z.literal('betterstack'),
    /** "Connect remotely" ClickHouse HTTP endpoint. */
    url: httpsUrl,
    username: z.string().trim().min(1).max(200),
    password: secret,
    /** Source table, e.g. `t123456_myapp_logs`. */
    table: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]+$/, 'Letters, digits and _ only')
      .max(200),
  }),
  z.object({
    tool: z.literal('cloudwatch'),
    region: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(-[a-z]+)+-\d$/, 'e.g. eu-west-1'),
    accessKeyId: z.string().trim().min(16).max(128),
    secretAccessKey: secret,
    /** Log groups to search, comma separated. */
    logGroups: z.array(z.string().trim().min(1).max(512)).min(1).max(20),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: httpsUrl,
    auth: z.enum(['apikey', 'basic']).default('apikey'),
    username: z.string().trim().max(200).optional(),
    token: secret,
    index: z.string().trim().min(1).max(200).default('logs-*'),
    serviceField: z.string().trim().min(1).max(100).default('service.name'),
  }),
]);
export type ConnectReaderInput = z.input<typeof connectReaderSchema>;

export interface ToolView {
  id: ToolId;
  name: string;
  description: string;
  /** What Way 7 reads from this tool, e.g. "Loki logs". */
  readsWhat: string;
  alerts: {
    enabled: boolean;
    sourceId: string | null;
    url: string | null;
    lastReceivedAt: string | null;
    lastError: string | null;
  };
  reader: {
    status: 'not_connected' | 'connected' | 'error';
    /** Non-secret settings, e.g. URL and organization. */
    settings: Record<string, string>;
    lastUsedAt: string | null;
    lastError: string | null;
  };
}

/** Turning alerts on returns the source token once, with setup text for that tool. */
export interface ToolAlertsEnabled {
  tool: ToolView;
  token: string | null;
  url: string;
  setup: string;
}

export const toolAlertsSchema = z.object({ enabled: z.boolean() });
export type ToolAlertsInput = z.infer<typeof toolAlertsSchema>;

/** Logs from a connected tool, normalized; used by the AI and by "Test connection". */
export interface ReaderLogLine {
  ts: string;
  level: string;
  message: string;
  service: string | null;
  url: string | null;
}
