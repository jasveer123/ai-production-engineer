export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ape:ape@localhost:5434/ape_test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  REDIS_URL: 'redis://localhost:6380',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'test',
  S3_SECRET_KEY: 'test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
  WEB_URL: 'http://localhost:3000',
  AUTH_DEV_LOGIN: 'true',
  OTEL_ENABLED: 'false',
  SECRETS_ENCRYPTION_KEY: 'a'.repeat(64),
  INGEST_WORKER_ENABLED: 'false',
  JAEGER_QUERY_URL: 'http://jaeger.test',
  TEMPORAL_NAMESPACE: 'ape-test',
  AUTO_INVESTIGATE: 'true',
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY_PATH: '/nonexistent/test.pem',
  GITHUB_WEBHOOK_SECRET: 'test-webhook-secret-not-real',
  SENTRY_APP_SLUG: 'ape-test',
  SENTRY_CLIENT_ID: 'sentry-client-id',
  SENTRY_CLIENT_SECRET: 'sentry-client-secret-not-real',
});
