import { z } from 'zod';
import { ToolView } from './connected-tools';

export interface SetupCapabilities {
  github: { configured: boolean };
  /** "Sign in and approve" flows that are configured on this server. */
  oauth: { sentry: boolean; vercel: boolean; heroku: boolean };
  /** Base URL other tools send to. Cloud tools cannot reach localhost. */
  publicUrl: string;
  publicUrlIsLocal: boolean;
  agent: { scriptUrl: string; kubernetesUrl: string };
  syslog: { host: string; port: number; tls: boolean } | null;
}

const serviceName = z
  .string()
  .trim()
  .min(1, 'Enter the service name')
  .max(100)
  .regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, dash and underscore only');

export const setupPrSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use the form owner/repo'),
  kind: z.enum(['agent', 'deploy']),
  service: serviceName,
  environment: z.string().trim().min(1).max(40).default('production'),
  /** App folder inside a monorepo, e.g. "services/api". Detected when empty. */
  directory: z.string().trim().max(200).optional(),
});
export type SetupPrInput = z.input<typeof setupPrSchema>;

export interface SetupPrResult {
  url: string;
  number: number;
  draft: boolean;
  /** The pull request already existed from an earlier run. */
  existing: boolean;
  language: 'node' | 'python' | null;
  done: string[];
  todo: string[];
}

export const autoSetupSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('grafana'),
    url: z.string().trim().url(),
    token: z.string().trim().min(1).max(4000),
    serviceLabel: z.string().trim().max(100).optional(),
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
    apiKey: z.string().trim().min(1).max(200),
    appKey: z.string().trim().min(1).max(200),
  }),
  z.object({
    tool: z.literal('elasticsearch'),
    url: z.string().trim().url(),
    kibanaUrl: z.string().trim().url().optional(),
    adminApiKey: z.string().trim().min(1).max(4000),
    index: z.string().trim().min(1).max(200).default('logs-*'),
    serviceField: z.string().trim().min(1).max(100).default('service.name'),
  }),
  z.object({
    tool: z.literal('betterstack'),
    apiToken: z.string().trim().min(1).max(4000),
    sourceName: z.string().trim().max(200).optional(),
  }),
]);
export type AutoSetupInput = z.input<typeof autoSetupSchema>;

export interface AutoSetupResult {
  tool: ToolView;
  done: string[];
  todo: string[];
}

export const vercelDrainSchema = z.object({
  accessToken: z.string().trim().min(1).max(4000),
  teamId: z.string().trim().max(100).optional(),
});
export const herokuDrainSchema = z.object({
  /** A Heroku API key; omit after "Sign in with Heroku". */
  apiKey: z.string().trim().max(4000).optional(),
  apps: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});
export const renderStreamSchema = z.object({ apiKey: z.string().trim().min(1).max(4000) });
export type VercelDrainInput = z.input<typeof vercelDrainSchema>;
export type HerokuDrainInput = z.input<typeof herokuDrainSchema>;
export type RenderStreamInput = z.input<typeof renderStreamSchema>;

export interface DrainSetupResult {
  done: string[];
  todo: string[];
  failed: string[];
}

export const herokuAppsSchema = z.object({ apiKey: z.string().trim().max(4000).optional() });
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

export interface OAuthCallbackResult {
  provider: 'sentry' | 'vercel' | 'heroku' | 'github';
  done: string[];
  todo: string[];
  /** Heroku: choose which apps get a drain next. */
  herokuApps?: string[];
  /** GitHub: pick repositories for this workspace after the App install callback. */
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
  expiresAt: string;
}

/** What the connected GitHub App installations can do, refreshed from GitHub. */
export interface GitHubOverview {
  configured: boolean;
  installations: {
    integrationId: string;
    installationId: number;
    account: string;
    status: 'connected' | 'error' | 'pending' | 'disconnected';
    lastError: string | null;
    repositorySelection: 'all' | 'selected' | null;
    repositories: string[];
    permissions: Record<string, string>;
    /** Where the account owner adds repositories to the installation. */
    manageUrl: string;
  }[];
  /** Permissions each automation needs that the App does not have. */
  missing: { setupPullRequest: string[]; deployWorkflow: string[] };
  /** Where the App owner changes the App's permissions. */
  appPermissionsUrl: string | null;
  /** Repositories set on Services that no installation can read. */
  unreachableServiceRepos: string[];
}
