import { z } from 'zod';
import {
  nameSchema,
  optionalText,
  repoFullNameSchema,
  secretSchema,
  urlSchema,
  type IsoTimestamp,
  type SetupOutcome,
} from '../common';
import {
  datadogSiteSchema,
  elasticIndexSchema,
  elasticServiceFieldSchema,
  type ToolView,
} from './tools';

export interface SetupCapabilities {
  github: { configured: boolean };
  oauth: { sentry: boolean; vercel: boolean; heroku: boolean };
  publicUrl: string;
  publicUrlIsLocal: boolean;
  agent: { scriptUrl: string; kubernetesUrl: string };
  syslog: { host: string; port: number; tls: boolean } | null;
}

export const setupPrSchema = z.object({
  repository: repoFullNameSchema,
  kind: z.enum(['agent', 'deploy']),
  service: nameSchema(100, 'Enter the service name').regex(
    /^[A-Za-z0-9._-]+$/,
    'Letters, digits, dot, dash and underscore only',
  ),
  environment: nameSchema(40).default('production'),
  directory: optionalText(200),
});
export type SetupPrInput = z.input<typeof setupPrSchema>;

export interface SetupPrResult extends SetupOutcome {
  url: string;
  number: number;
  draft: boolean;
  existing: boolean;
  language: 'node' | 'python' | null;
}

export const autoSetupSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    url: urlSchema,
    token: secretSchema,
    serviceLabel: optionalText(100),
  }),
  z.object({
    tool: z.literal('datadog'),
    site: datadogSiteSchema,
    apiKey: nameSchema(200),
    appKey: nameSchema(200),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: urlSchema,
    kibanaUrl: urlSchema.optional(),
    adminApiKey: secretSchema,
    index: elasticIndexSchema,
    serviceField: elasticServiceFieldSchema,
  }),
  z.object({
    tool: z.literal('betterstack'),
    apiToken: secretSchema,
    sourceName: optionalText(200),
  }),
]);
export type AutoSetupInput = z.input<typeof autoSetupSchema>;

export interface AutoSetupResult extends SetupOutcome {
  tool: ToolView;
}

export const vercelDrainSchema = z.object({
  accessToken: secretSchema,
  teamId: optionalText(100),
});
export const herokuDrainSchema = z.object({
  apiKey: optionalText(4000),
  apps: z.array(nameSchema(100)).min(1).max(50),
});
export const renderStreamSchema = z.object({ apiKey: secretSchema });
export type VercelDrainInput = z.input<typeof vercelDrainSchema>;
export type HerokuDrainInput = z.input<typeof herokuDrainSchema>;
export type RenderStreamInput = z.input<typeof renderStreamSchema>;

export interface DrainSetupResult extends SetupOutcome {
  failed: string[];
}

export const herokuAppsSchema = z.object({ apiKey: optionalText(4000) });
export interface HerokuApps {
  apps: string[];
}

export interface OAuthStart {
  url: string;
}

export const oauthCallbackSchema = z.object({
  state: z.string().min(10).max(2000),
  code: z.string().max(2000).optional(),
  installationId: z.string().max(200).optional(),
  configurationId: z.string().max(200).optional(),
  teamId: z.string().max(200).optional(),
});
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

export interface OAuthCallbackResult extends SetupOutcome {
  provider: 'sentry' | 'vercel' | 'heroku' | 'github';
  herokuApps?: string[];
  githubInstallationId?: number;
}

export const githubSetupCallbackSchema = z.object({
  installationId: z.coerce.number().int().positive(),
  state: z.string().min(10).max(2000),
});
export type GitHubSetupCallbackInput = z.input<typeof githubSetupCallbackSchema>;

export interface AwsSetupStart {
  command: string;
  templateUrl: string;
  expiresAt: IsoTimestamp;
}
