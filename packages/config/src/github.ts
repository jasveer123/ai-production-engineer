import { z } from 'zod';
import { MINUTE, optionalText, positiveInt, text, urlWithDefault } from './helpers';

export const githubEnv = {
  GITHUB_OIDC_AUDIENCE: text('ape'),
  GITHUB_APP_ID: z.string().regex(/^\d+$/).optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: optionalText,
  GITHUB_API_URL: urlWithDefault('https://api.github.com'),
  GITHUB_WEBHOOK_SECRET: z.string().min(16).optional(),
  GITHUB_HEALTH_INTERVAL_MS: positiveInt(MINUTE),
  PR_SYNC_INTERVAL_MS: positiveInt(MINUTE),
};
