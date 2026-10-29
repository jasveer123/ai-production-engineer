import { z } from 'zod';
import { booleanFlag, optionalText, positiveInt, text } from './helpers';

export const authEnv = {
  JWT_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: positiveInt(168),
  SECRETS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters'),
  GITHUB_OAUTH_CLIENT_ID: optionalText,
  GITHUB_OAUTH_CLIENT_SECRET: optionalText,
  AUTH_DEV_LOGIN: booleanFlag.default('false'),
  MAIL_FROM: z.string().min(3).default('AI Production Engineer <no-reply@localhost>'),
  RESEND_API_KEY: optionalText,
};
