const test = require('node:test');
const assert = require('node:assert/strict');
const { apiEnvSchema, loadEnv } = require('../dist');
const load = (extra = {}) => loadEnv(apiEnvSchema, { ...required, ...extra });

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

test('boolean flags accept only true or false', () => {
  assert.equal(load({ OTEL_ENABLED: 'false' }).OTEL_ENABLED, false);
  assert.equal(load({ SYSLOG_ENABLED: 'true' }).SYSLOG_ENABLED, true);
  assert.throws(() => load({ AUTO_INVESTIGATE: 'yes' }), /AUTO_INVESTIGATE/);
});

test('urls are validated and defaults are applied', () => {
  const env = load();
  assert.equal(env.WEB_URL, 'http://localhost:3000');
  assert.equal(env.PUBLIC_API_URL, 'http://localhost:4000');
  assert.equal(env.SENTRY_URL, 'https://sentry.io');
  assert.equal(env.GITHUB_API_URL, 'https://api.github.com');
  assert.equal(env.PUBLIC_INGEST_URL, undefined);
  assert.throws(() => load({ WEB_URL: 'not a url' }), /WEB_URL/);
  assert.throws(() => load({ DATABASE_URL: 'nope' }), /DATABASE_URL/);
});

test('numeric bounds', () => {
  assert.equal(load().INGEST_MAX_BODY_MB, 10);
  assert.throws(() => load({ INGEST_MAX_BODY_MB: '0' }), /INGEST_MAX_BODY_MB/);
  assert.throws(() => load({ INGEST_MAX_BODY_MB: '51' }), /INGEST_MAX_BODY_MB/);
  assert.throws(() => load({ LOG_RETENTION_DAYS: '366' }), /LOG_RETENTION_DAYS/);
  assert.throws(() => load({ API_PORT: '0' }), /API_PORT/);
  assert.throws(() => load({ API_PORT: '1.5' }), /API_PORT/);
  assert.throws(() => load({ VERIFY_MAX_WINDOWS: '11' }), /VERIFY_MAX_WINDOWS/);
  assert.equal(load({ VERIFY_GRACE_MS: '0' }).VERIFY_GRACE_MS, 0);
  assert.throws(() => load({ VERIFY_GRACE_MS: '-1' }), /VERIFY_GRACE_MS/);
});

test('verification and polling defaults', () => {
  const env = load();
  assert.equal(env.VERIFY_GRACE_MS, 120_000);
  assert.equal(env.VERIFY_WINDOW_MS, 1_800_000);
  assert.equal(env.VERIFY_SETTLE_MS, 45_000);
  assert.equal(env.VERIFY_CHECK_EVERY_MS, 300_000);
  assert.equal(env.VERIFY_DEPLOY_WAIT_MS, 604_800_000);
  assert.equal(env.VERIFY_DEPLOY_POLL_MS, 300_000);
  assert.equal(env.VERIFY_MAX_WINDOWS, 3);
  assert.equal(env.VERIFY_MIN_ERRORS, 3);
  assert.equal(env.VERIFY_MIN_REQUESTS, 20);
  assert.equal(env.HEARTBEAT_CHECK_INTERVAL_MS, 15_000);
  assert.equal(env.GITHUB_HEALTH_INTERVAL_MS, 60_000);
  assert.equal(env.PR_SYNC_INTERVAL_MS, 60_000);
  assert.equal(env.JAEGER_POLL_INTERVAL_MS, 15_000);
  assert.equal(env.REALTIME_BATCH_MS, 500);
  assert.equal(env.REALTIME_RECHECK_MS, 60_000);
});

test('GitHub App settings are validated when set', () => {
  assert.equal(load({ GITHUB_APP_ID: '12345' }).GITHUB_APP_ID, '12345');
  assert.throws(() => load({ GITHUB_APP_ID: 'abc' }), /GITHUB_APP_ID/);
  assert.throws(() => load({ GITHUB_WEBHOOK_SECRET: 'short' }), /GITHUB_WEBHOOK_SECRET/);
  assert.equal(load().GITHUB_OIDC_AUDIENCE, 'ape');
});

test('syslog, mail and temporal defaults', () => {
  const env = load();
  assert.equal(env.SYSLOG_PORT, 6514);
  assert.equal(env.SYSLOG_PUBLIC_HOST, 'localhost');
  assert.equal(env.MAIL_FROM, 'AI Production Engineer <no-reply@localhost>');
  assert.equal(env.TEMPORAL_NAMESPACE, 'default');
  assert.equal(env.SESSION_TTL_HOURS, 168);
  assert.equal(env.JAEGER_QUERY_URL, 'http://localhost:16686');
  assert.throws(() => load({ MAIL_FROM: 'ab' }), /MAIL_FROM/);
});

test('loadEnv reads process.env by default', () => {
  const saved = { ...process.env };
  Object.assign(process.env, required);
  try {
    assert.equal(loadEnv(apiEnvSchema).API_PORT, 4000);
  } finally {
    process.env = saved;
  }
});
