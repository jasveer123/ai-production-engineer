import { optionalText, urlWithDefault } from './helpers';

export const providersEnv = {
  SENTRY_URL: urlWithDefault('https://sentry.io'),
  SENTRY_APP_SLUG: optionalText,
  SENTRY_CLIENT_ID: optionalText,
  SENTRY_CLIENT_SECRET: optionalText,
  VERCEL_INTEGRATION_SLUG: optionalText,
  VERCEL_CLIENT_ID: optionalText,
  VERCEL_CLIENT_SECRET: optionalText,
  HEROKU_CLIENT_ID: optionalText,
  HEROKU_CLIENT_SECRET: optionalText,
};
