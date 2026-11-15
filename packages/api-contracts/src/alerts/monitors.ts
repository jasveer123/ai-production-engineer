import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';

export const MONITOR_KINDS = [
  'http',
  'keyword',
  'status',
  'ping',
  'tcp',
  'udp',
  'smtp',
  'pop3',
  'imap',
  'dns',
] as const;
export type MonitorKind = (typeof MONITOR_KINDS)[number];

export const HTTP_MONITOR_KINDS: readonly MonitorKind[] = ['http', 'keyword', 'status'];
export const MAIL_DEFAULT_PORTS = { smtp: 25, pop3: 110, imap: 143 } as const;

export const KEYWORD_MODES = ['present', 'absent'] as const;
export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS'] as const;
export const IP_VERSIONS = ['any', 'v4', 'v6'] as const;
export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT'] as const;
export const MONITOR_REGIONS = ['eu', 'us', 'asia', 'au'] as const;
export const CHECK_INTERVALS = [30, 45, 60, 120, 180, 300, 600, 900, 1800] as const;
export const EXPIRY_ALERT_DAYS = [1, 2, 3, 7, 14, 30, 60] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOST =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV6 = /^[0-9a-f:]+$/i;

export const isHostOrIp = (v: string) =>
  HOST.test(v) || IPV4.test(v) || (v.includes(':') && IPV6.test(v));
export const isIpAddress = (v: string) => IPV4.test(v) || (v.includes(':') && IPV6.test(v));

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const keyValue = z.object({
  key: z.string().trim().min(1).max(100),
  value: z.string().trim().max(500),
});
const header = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[!#$%&'*+.^_`|~0-9a-z-]+$/i, 'Not a valid header name'),
  value: z.string().max(2000),
});

export const maintenanceWindowSchema = z.object({
  from: z.string().regex(TIME, 'Use HH:MM'),
  to: z.string().regex(TIME, 'Use HH:MM'),
  timezone: z.string().refine(validTimezone, 'Unknown time zone'),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});
export type MaintenanceWindow = z.infer<typeof maintenanceWindowSchema>;

const fields = {
  name: nameSchema(80),
  kind: z.enum(MONITOR_KINDS),
  pronounceableName: z.string().trim().max(120).nullable(),
  url: z.string().trim().url().max(2000).nullable(),
  host: z.string().trim().min(1).max(253).nullable(),
  port: z.number().int().min(1).max(65535).nullable(),
  keyword: z.string().trim().min(1).max(200).nullable(),
  keywordMode: z.enum(KEYWORD_MODES),
  expectedStatuses: z.array(z.number().int().min(100).max(599)).max(20),
  udpPayload: z.string().max(1000).nullable(),
  dnsDomain: z.string().trim().max(253).nullable(),
  dnsRecordType: z.enum(DNS_RECORD_TYPES),
  dnsExpected: z.string().trim().max(500).nullable(),
  method: z.enum(HTTP_METHODS),
  headers: z.array(header).max(30),
  body: z.string().max(10_000).nullable(),
  followRedirects: z.boolean(),
  keepCookies: z.boolean(),
  basicAuthUser: z.string().max(200).nullable(),
  timeoutSeconds: z.number().int().min(2).max(180),
  ipVersion: z.enum(IP_VERSIONS),
  verifyTls: z.boolean(),
  intervalSeconds: z
    .number()
    .int()
    .refine((v) => (CHECK_INTERVALS as readonly number[]).includes(v), 'Unsupported frequency'),
  confirmationSeconds: z.number().int().min(0).max(1800),
  recoverySeconds: z.number().int().min(0).max(7200),
  sslExpiryDays: z.number().int().min(1).max(60).nullable(),
  domainExpiryDays: z.number().int().min(1).max(60).nullable(),
  maintenance: maintenanceWindowSchema.nullable(),
  regions: z.array(z.enum(MONITOR_REGIONS)).min(1).max(4),
  metadata: z.array(keyValue).max(20),
  escalationPolicyId: z.string().uuid().nullable(),
};

export const monitorSettingsSchema = z.object(fields);
export type MonitorSettings = z.infer<typeof monitorSettingsSchema>;

export const MONITOR_DEFAULTS: Omit<MonitorSettings, 'name' | 'kind'> = {
  pronounceableName: null,
  url: null,
  host: null,
  port: null,
  keyword: null,
  keywordMode: 'present',
  expectedStatuses: [],
  udpPayload: null,
  dnsDomain: null,
  dnsRecordType: 'A',
  dnsExpected: null,
  method: 'GET',
  headers: [],
  body: null,
  followRedirects: true,
  keepCookies: true,
  basicAuthUser: null,
  timeoutSeconds: 30,
  ipVersion: 'any',
  verifyTls: true,
  intervalSeconds: 180,
  confirmationSeconds: 0,
  recoverySeconds: 180,
  sslExpiryDays: null,
  domainExpiryDays: null,
  maintenance: null,
  regions: ['eu', 'us'],
  metadata: [],
  escalationPolicyId: null,
};

export interface MonitorIssue {
  path: string;
  message: string;
}

export function monitorIssues(m: MonitorSettings): MonitorIssue[] {
  const issues: MonitorIssue[] = [];
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) issues.push({ path, message });
  };
  if (HTTP_MONITOR_KINDS.includes(m.kind)) {
    need(Boolean(m.url), 'url', 'Enter the address to check');
    need(!m.url || /^https?:\/\//i.test(m.url), 'url', 'Use an http or https address');
    if (m.kind === 'keyword') {
      need(Boolean(m.keyword), 'keyword', 'Enter the keyword to look for');
      need(m.method !== 'HEAD', 'method', 'A HEAD request has no body to search');
    }
    if (m.kind === 'status')
      need(m.expectedStatuses.length > 0, 'expectedStatuses', 'Pick at least one status code');
    need(!(m.method === 'HEAD' && m.body), 'body', 'A HEAD request cannot send a body');
  } else {
    need(Boolean(m.host && isHostOrIp(m.host)), 'host', 'Enter a host name or IP address');
  }
  if (m.kind === 'tcp' || m.kind === 'udp') need(m.port !== null, 'port', 'Enter the port');
  if (m.kind === 'dns') {
    need(!m.host || isIpAddress(m.host), 'host', 'Enter the DNS server as an IP address');
    need(
      Boolean(m.dnsDomain && isHostOrIp(m.dnsDomain)),
      'dnsDomain',
      'Enter the domain to resolve',
    );
  }
  if (m.sslExpiryDays !== null)
    need(
      Boolean(m.url?.toLowerCase().startsWith('https://')),
      'sslExpiryDays',
      'SSL alerts need an https address',
    );
  if (m.domainExpiryDays !== null)
    need(Boolean(m.url || m.host), 'domainExpiryDays', 'Domain alerts need an address');
  if (m.maintenance)
    need(m.maintenance.from !== m.maintenance.to, 'maintenance', 'Start and end must differ');
  return issues;
}

const addIssues = (m: MonitorSettings, ctx: z.RefinementCtx) => {
  for (const issue of monitorIssues(m))
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message });
};

export const createMonitorSchema = monitorSettingsSchema
  .partial()
  .required({ name: true, kind: true })
  .extend({ basicAuthPassword: z.string().max(500).nullable().optional() })
  .transform((m) => ({ ...MONITOR_DEFAULTS, ...m, basicAuthPassword: m.basicAuthPassword ?? null }))
  .superRefine(addIssues);
export type CreateMonitorInput = z.input<typeof createMonitorSchema>;
export type CreateMonitorValues = MonitorSettings & { basicAuthPassword: string | null };

export const updateMonitorSchema = monitorSettingsSchema.partial().extend({
  paused: z.boolean().optional(),
  basicAuthPassword: z.string().max(500).nullable().optional(),
});
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

export const bulkCreateMonitorsSchema = z.object({
  urls: z.array(z.string().trim().url().max(2000)).min(1).max(100),
  intervalSeconds: fields.intervalSeconds.default(180),
});
export type BulkCreateMonitorsInput = z.input<typeof bulkCreateMonitorsSchema>;

export type MonitorState = 'pending' | 'up' | 'down';

export interface MonitorView extends MonitorSettings {
  id: Uuid;
  hasBasicAuthPassword: boolean;
  paused: boolean;
  inMaintenance: boolean;
  state: MonitorState;
  stateSince: IsoTimestamp;
  version: number;
  lastCheckedAt: IsoTimestamp | null;
  lastStatusCode: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
  nextCheckAt: IsoTimestamp | null;
  sslExpiresAt: IsoTimestamp | null;
  domainExpiresAt: IsoTimestamp | null;
  uptime24h: number | null;
  createdAt: IsoTimestamp;
}

export interface MonitorBucket {
  at: IsoTimestamp;
  total: number;
  failures: number;
  avgMs: number | null;
}

export interface CheckTimings {
  dnsMs: number | null;
  connectMs: number | null;
  tlsMs: number | null;
  firstByteMs: number | null;
}

export interface MonitorCheckView {
  id: number;
  checkedAt: IsoTimestamp;
  ok: boolean;
  statusCode: number | null;
  responseMs: number;
  error: string | null;
  region: string | null;
  maintenance: boolean;
  transition: 'down' | 'up' | null;
  timings: CheckTimings | null;
}

export interface MonitorAvailability {
  period: 'today' | '7d' | '30d' | '365d';
  availability: number | null;
  downtimeSeconds: number;
  incidents: number;
}

export interface MonitorIncidentView {
  id: Uuid;
  title: string;
  status: string;
  startedAt: IsoTimestamp;
}

export interface MonitorDetail extends MonitorView {
  history: MonitorBucket[];
  recent: MonitorCheckView[];
  availability: MonitorAvailability[];
  incidents: MonitorIncidentView[];
  probeLocation: string;
  badgeUrl: string;
}

export interface BulkCreateMonitorsResult {
  created: MonitorView[];
  failed: { url: string; message: string }[];
}
