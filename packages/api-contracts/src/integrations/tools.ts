import { z } from 'zod';
import {
  boundedUrlSchema,
  nameSchema,
  optionalText,
  secretSchema,
  type IsoTimestamp,
  type Uuid,
  type ValueOf,
} from '../common';

export const TOOL_IDS = [
  'grafana',
  'datadog',
  'sentry',
  'betterstack',
  'cloudwatch',
  'elasticsearch',
] as const;
export type ToolId = ValueOf<typeof TOOL_IDS>;

export const DATADOG_SITES = [
  'datadoghq.com',
  'us3.datadoghq.com',
  'us5.datadoghq.com',
  'datadoghq.eu',
  'ap1.datadoghq.com',
  'ddog-gov.com',
] as const;
export const datadogSiteSchema = z.enum(DATADOG_SITES).default('datadoghq.com');

export const elasticIndexSchema = nameSchema(200).default('logs-*');
export const elasticServiceFieldSchema = nameSchema(100).default('service.name');

export const connectReaderSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    url: boundedUrlSchema,
    auth: z.enum(['bearer', 'basic']).default('bearer'),
    username: optionalText(200),
    token: secretSchema,
    orgId: optionalText(100),
    serviceLabel: nameSchema(100).default('service_name'),
  }),
  z.object({
    tool: z.literal('datadog'),
    site: datadogSiteSchema,
    apiKey: secretSchema,
    appKey: secretSchema,
  }),
  z.object({
    tool: z.literal('sentry'),
    url: boundedUrlSchema.default('https://sentry.io'),
    organization: nameSchema(100),
    token: secretSchema,
  }),
  z.object({
    tool: z.literal('betterstack'),
    url: boundedUrlSchema,
    username: nameSchema(200),
    password: secretSchema,
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
    secretAccessKey: secretSchema,
    logGroups: z.array(nameSchema(512)).min(1).max(20),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: boundedUrlSchema,
    auth: z.enum(['apikey', 'basic']).default('apikey'),
    username: optionalText(200),
    token: secretSchema,
    index: elasticIndexSchema,
    serviceField: elasticServiceFieldSchema,
  }),
]);
export type ConnectReaderInput = z.input<typeof connectReaderSchema>;

export const toolAlertsSchema = z.object({ enabled: z.boolean() });
export type ToolAlertsInput = z.infer<typeof toolAlertsSchema>;

export interface ToolView {
  id: ToolId;
  name: string;
  description: string;
  readsWhat: string;
  alerts: {
    enabled: boolean;
    sourceId: Uuid | null;
    url: string | null;
    lastReceivedAt: IsoTimestamp | null;
    lastError: string | null;
  };
  reader: {
    status: 'not_connected' | 'connected' | 'error';
    settings: Record<string, string>;
    lastUsedAt: IsoTimestamp | null;
    lastError: string | null;
  };
}

export interface ToolAlertsEnabled {
  tool: ToolView;
  token: string | null;
  url: string;
  setup: string;
}

export interface ReaderLogLine {
  ts: IsoTimestamp;
  level: string;
  message: string;
  service: string | null;
  url: string | null;
}
