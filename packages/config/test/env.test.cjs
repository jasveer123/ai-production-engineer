const test = require('node:test');
const assert = require('node:assert/strict');
const { apiEnvSchema, loadEnv } = require('../dist');

const required = {
  DATABASE_URL: 'postgresql://ape:ape@localhost:5432/ape',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'j'.repeat(32),
  SECRETS_ENCRYPTION_KEY: 'a'.repeat(64),
};

test('applies defaults when only required values are set', () => {
  const env = loadEnv(apiEnvSchema, required);
  assert.equal(env.NODE_ENV, 'development');
  assert.equal(env.API_PORT, 4000);
  assert.equal(env.AUTH_DEV_LOGIN, false);
  assert.equal(env.OTEL_ENABLED, true);
  assert.equal(env.TEMPORAL_ADDRESS, 'localhost:7233');
});

test('coerces numbers from strings', () => {
  assert.equal(loadEnv(apiEnvSchema, { ...required, API_PORT: '8080' }).API_PORT, 8080);
});

test('fails fast and names every missing required value', () => {
  assert.throws(
    () => loadEnv(apiEnvSchema, {}),
    (e) =>
      /DATABASE_URL/.test(e.message) &&
      /JWT_SECRET/.test(e.message) &&
      /SECRETS_ENCRYPTION_KEY/.test(e.message),
  );
});

test('rejects a short JWT secret and a malformed encryption key', () => {
  assert.throws(() => loadEnv(apiEnvSchema, { ...required, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(
    () => loadEnv(apiEnvSchema, { ...required, SECRETS_ENCRYPTION_KEY: 'zz' }),
    /SECRETS_ENCRYPTION_KEY/,
  );
});

test('refuses AUTH_DEV_LOGIN in production but allows it elsewhere', () => {
  assert.throws(
    () => loadEnv(apiEnvSchema, { ...required, NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true' }),
    /AUTH_DEV_LOGIN must be false in production/,
  );
  assert.equal(
    loadEnv(apiEnvSchema, { ...required, NODE_ENV: 'production' }).AUTH_DEV_LOGIN,
    false,
  );
  assert.equal(loadEnv(apiEnvSchema, { ...required, AUTH_DEV_LOGIN: 'true' }).AUTH_DEV_LOGIN, true);
});

test('S3 credentials and endpoint are all optional (instance role on AWS)', () => {
  const env = loadEnv(apiEnvSchema, required);
  assert.equal(env.S3_ENDPOINT, undefined);
  assert.equal(env.S3_ACCESS_KEY, undefined);
  assert.equal(env.S3_SECRET_KEY, undefined);
  assert.equal(env.S3_BUCKET, 'ape-artifacts');
});

test('S3 values are used when set and an empty value counts as unset', () => {
  const env = loadEnv(apiEnvSchema, {
    ...required,
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
  });
  assert.equal(env.S3_ENDPOINT, 'http://localhost:9000');
  assert.equal(env.S3_ACCESS_KEY, 'key');
  const blank = loadEnv(apiEnvSchema, { ...required, S3_ACCESS_KEY: '', S3_REGION: '' });
  assert.equal(blank.S3_ACCESS_KEY, undefined);
  assert.equal(blank.S3_REGION, 'us-east-1');
});
