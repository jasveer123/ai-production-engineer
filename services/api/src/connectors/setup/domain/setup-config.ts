import type { ApiEnv } from '../../../core/config/config.module';

export const trimSlash = (url: string): string => url.replace(/\/$/, '');

export const apiUrl = (env: ApiEnv): string => trimSlash(env.PUBLIC_API_URL);

export const ingestUrl = (env: ApiEnv): string =>
  trimSlash(env.PUBLIC_INGEST_URL ?? env.PUBLIC_API_URL);

export const callbackUrl = (env: ApiEnv, provider: string): string =>
  `${trimSlash(env.WEB_URL)}/integrations/callback/${provider}/`;

export const sentryConfigured = (env: ApiEnv): boolean =>
  Boolean(env.SENTRY_APP_SLUG && env.SENTRY_CLIENT_ID && env.SENTRY_CLIENT_SECRET);

export const sentryConfig = (env: ApiEnv) => ({
  url: env.SENTRY_URL,
  clientId: env.SENTRY_CLIENT_ID!,
  clientSecret: env.SENTRY_CLIENT_SECRET!,
});

export const vercelConfigured = (env: ApiEnv): boolean =>
  Boolean(env.VERCEL_INTEGRATION_SLUG && env.VERCEL_CLIENT_ID && env.VERCEL_CLIENT_SECRET);

export const herokuConfigured = (env: ApiEnv): boolean =>
  Boolean(env.HEROKU_CLIENT_ID && env.HEROKU_CLIENT_SECRET);
