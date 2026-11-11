import { z } from 'zod';
import { nameSchema, type IsoTimestamp, type Uuid } from '../common';

export const MONITOR_KINDS = ['http', 'keyword', 'status', 'tcp'] as const;
export type MonitorKind = (typeof MONITOR_KINDS)[number];

export const KEYWORD_MODES = ['present', 'absent'] as const;

const baseMonitor = z.object({
  name: nameSchema(80),
  kind: z.enum(MONITOR_KINDS),
  url: z.string().trim().url().max(2000).optional(),
  host: z.string().trim().min(1).max(253).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  intervalSeconds: z.number().int().min(30).max(86_400).default(180),
  timeoutSeconds: z.number().int().min(1).max(60).default(15),
  confirmations: z.number().int().min(1).max(5).default(2),
  expectedStatus: z.number().int().min(100).max(599).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  keywordMode: z.enum(KEYWORD_MODES).default('present'),
});

export const createMonitorSchema = baseMonitor.superRefine((m, ctx) => {
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) ctx.addIssue({ code: 'custom', path: [path], message });
  };
  if (m.kind === 'tcp') {
    need(Boolean(m.host), 'host', 'Enter the host to check');
    need(m.port !== undefined, 'port', 'Enter the port to check');
    return;
  }
  need(Boolean(m.url), 'url', 'Enter the address to check');
  need(!m.url || /^https?:\/\//i.test(m.url), 'url', 'Use an http or https address');
  if (m.kind === 'keyword') need(Boolean(m.keyword), 'keyword', 'Enter the word to look for');
  if (m.kind === 'status')
    need(m.expectedStatus !== undefined, 'expectedStatus', 'Enter the status code');
});
export type CreateMonitorInput = z.input<typeof createMonitorSchema>;

export const updateMonitorSchema = z.object({
  name: nameSchema(80).optional(),
  intervalSeconds: baseMonitor.shape.intervalSeconds.optional(),
  timeoutSeconds: baseMonitor.shape.timeoutSeconds.optional(),
  confirmations: baseMonitor.shape.confirmations.optional(),
  paused: z.boolean().optional(),
});
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

export type MonitorState = 'pending' | 'up' | 'down';

export interface MonitorView {
  id: Uuid;
  name: string;
  kind: MonitorKind;
  url: string | null;
  host: string | null;
  port: number | null;
  expectedStatus: number | null;
  keyword: string | null;
  keywordMode: 'present' | 'absent';
  intervalSeconds: number;
  timeoutSeconds: number;
  confirmations: number;
  paused: boolean;
  state: MonitorState;
  stateSince: IsoTimestamp;
  lastCheckedAt: IsoTimestamp | null;
  lastStatusCode: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
  uptime24h: number | null;
  createdAt: IsoTimestamp;
}

export interface MonitorBucket {
  at: IsoTimestamp;
  total: number;
  failures: number;
  avgMs: number | null;
}

export interface MonitorCheckView {
  id: number;
  checkedAt: IsoTimestamp;
  ok: boolean;
  statusCode: number | null;
  responseMs: number;
  error: string | null;
}

export interface MonitorDetail extends MonitorView {
  history: MonitorBucket[];
  recent: MonitorCheckView[];
}
