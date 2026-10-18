// Test environment. TEST_DATABASE_URL lets CI point at its own Postgres service.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ape:ape@localhost:5433/ape_test';

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
});
