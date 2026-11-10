import { z } from 'zod';
import {
  booleanFlag,
  nonNegativeInt,
  optionalText,
  optionalUrl,
  positiveInt,
  text,
} from './helpers';

export const authEnv = {
  JWT_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: positiveInt(168),
  ACCESS_TTL_MINUTES: positiveInt(15),
  SECRETS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters'),
  GITHUB_OAUTH_CLIENT_ID: optionalText,
  GITHUB_OAUTH_CLIENT_SECRET: optionalText,
  SLACK_OAUTH_CLIENT_ID: optionalText,
  SLACK_OAUTH_CLIENT_SECRET: optionalText,
  AUTH_DEV_LOGIN: booleanFlag.default('false'),
  MAIL_FROM: z.string().min(3).default('AI Production Engineer <no-reply@localhost>'),
  RESEND_API_KEY: optionalText,
  SMTP_URL: optionalText,
  TRUST_PROXY: nonNegativeInt(0),
  OAUTH_CALLBACK_BASE_URL: optionalUrl,
};
