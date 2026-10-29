const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, c } = require('./helpers.cjs');

const url = 'https://example.com';

test('createIntegrationSchema validates provider and name', () => {
  for (const provider of c.INTEGRATION_PROVIDERS)
    ok(c.createIntegrationSchema, { provider, name: 'n' });
  bad(c.createIntegrationSchema, { provider: 'svn', name: 'n' });
  bad(c.createIntegrationSchema, { provider: 'github', name: '' });
});

test('connectGitHubSchema defaults the name and validates repositories', () => {
  assert.equal(parse(c.connectGitHubSchema, { installationId: 1 }).name, 'GitHub');
  ok(c.connectGitHubSchema, { installationId: 1, repositories: ['acme/api'] });
  bad(c.connectGitHubSchema, { installationId: 0 });
  bad(c.connectGitHubSchema, { installationId: 1, repositories: [] });
  bad(c.connectGitHubSchema, { installationId: 1, repositories: ['nope'] });
});

test('connectReaderSchema: each tool has required credentials and defaults', () => {
  assert.equal(
    parse(c.connectReaderSchema, { tool: 'grafana', url, token: 't' }).serviceLabel,
    'service_name',
  );
  assert.equal(
    parse(c.connectReaderSchema, { tool: 'datadog', apiKey: 'a', appKey: 'b' }).site,
    'datadoghq.com',
  );
  assert.equal(
    parse(c.connectReaderSchema, { tool: 'sentry', organization: 'o', token: 't' }).url,
    'https://sentry.io',
  );
  const es = parse(c.connectReaderSchema, { tool: 'elasticsearch', url, token: 't' });
  assert.equal(es.index, 'logs-*');
  assert.equal(es.serviceField, 'service.name');
  assert.equal(es.auth, 'apikey');
  ok(c.connectReaderSchema, {
    tool: 'betterstack',
    url,
    username: 'u',
    password: 'p',
    table: 't123_logs',
  });
  ok(c.connectReaderSchema, {
    tool: 'cloudwatch',
    region: 'eu-west-1',
    accessKeyId: 'A'.repeat(16),
    secretAccessKey: 's',
    logGroups: ['/aws/lambda/x'],
  });
});

test('connectReaderSchema rejects bad input', () => {
  bad(c.connectReaderSchema, { tool: 'grafana', url: 'nope', token: 't' });
  bad(c.connectReaderSchema, { tool: 'grafana', url });
  bad(c.connectReaderSchema, { tool: 'datadog', site: 'example.com', apiKey: 'a', appKey: 'b' });
  bad(c.connectReaderSchema, {
    tool: 'betterstack',
    url,
    username: 'u',
    password: 'p',
    table: 'bad-name',
  });
  bad(c.connectReaderSchema, {
    tool: 'cloudwatch',
    region: 'moon',
    accessKeyId: 'A'.repeat(16),
    secretAccessKey: 's',
    logGroups: ['g'],
  });
  bad(c.connectReaderSchema, {
    tool: 'cloudwatch',
    region: 'eu-west-1',
    accessKeyId: 'A'.repeat(16),
    secretAccessKey: 's',
    logGroups: [],
  });
  bad(c.connectReaderSchema, { tool: 'unknown' });
});

test('toolAlertsSchema needs a boolean', () => {
  ok(c.toolAlertsSchema, { enabled: true });
  bad(c.toolAlertsSchema, { enabled: 'yes' });
  for (const id of c.TOOL_IDS) assert.equal(typeof id, 'string');
});

test('notification events and labels line up', () => {
  for (const e of c.NOTIFICATION_EVENTS) {
    ok(c.notificationEventSchema, e);
    assert.ok(c.NOTIFICATION_EVENT_LABELS[e]);
  }
  bad(c.notificationEventSchema, 'incident.deleted');
});

test('createNotificationChannelSchema: slack webhook pattern and defaults', () => {
  const slack = {
    kind: 'slack',
    name: 'ops',
    webhookUrl: 'https://hooks.slack.com/services/T0/B0/xyz',
    events: ['incident.detected'],
  };
  assert.equal(parse(c.createNotificationChannelSchema, slack).minSeverity, 'low');
  bad(c.createNotificationChannelSchema, { ...slack, webhookUrl: 'https://evil.com/services/T0' });
  bad(c.createNotificationChannelSchema, { ...slack, events: [] });
  bad(c.createNotificationChannelSchema, { ...slack, events: ['nope'] });
  ok(c.createNotificationChannelSchema, {
    kind: 'webhook',
    name: 'w',
    url,
    events: ['incident.resolved'],
    minSeverity: 'high',
  });
  bad(c.createNotificationChannelSchema, {
    kind: 'webhook',
    name: 'w',
    url: 'nope',
    events: ['incident.resolved'],
  });
  assert.match('https://hooks.slack.com/services/T0/B0/xyz', c.SLACK_WEBHOOK_PATTERN);
});

test('updateNotificationChannelSchema is fully optional', () => {
  ok(c.updateNotificationChannelSchema, {});
  ok(c.updateNotificationChannelSchema, { enabled: false, minSeverity: 'critical' });
  bad(c.updateNotificationChannelSchema, { events: [] });
  bad(c.updateNotificationChannelSchema, { name: '' });
});

test('setupPrSchema validates repository, kind and service name', () => {
  const base = { repository: 'acme/api', kind: 'agent', service: 'api-1' };
  assert.equal(parse(c.setupPrSchema, base).environment, 'production');
  bad(c.setupPrSchema, { ...base, repository: 'acme' });
  bad(c.setupPrSchema, { ...base, kind: 'other' });
  bad(c.setupPrSchema, { ...base, service: 'has space' });
  bad(c.setupPrSchema, { ...base, service: '' });
});

test('autoSetupSchema: each tool and its defaults', () => {
  ok(c.autoSetupSchema, { tool: 'grafana', url, token: 't' });
  assert.equal(
    parse(c.autoSetupSchema, { tool: 'datadog', apiKey: 'a', appKey: 'b' }).site,
    'datadoghq.com',
  );
  const es = parse(c.autoSetupSchema, { tool: 'elasticsearch', url, adminApiKey: 'k' });
  assert.equal(es.index, 'logs-*');
  ok(c.autoSetupSchema, { tool: 'betterstack', apiToken: 't' });
  bad(c.autoSetupSchema, { tool: 'grafana', url: 'nope', token: 't' });
  bad(c.autoSetupSchema, { tool: 'betterstack' });
  bad(c.autoSetupSchema, { tool: 'sentry' });
});

test('drain and stream setup schemas', () => {
  ok(c.vercelDrainSchema, { accessToken: 't' });
  bad(c.vercelDrainSchema, { accessToken: '' });
  ok(c.herokuDrainSchema, { apps: ['a'] });
  bad(c.herokuDrainSchema, { apps: [] });
  ok(c.renderStreamSchema, { apiKey: 'k' });
  bad(c.renderStreamSchema, {});
  ok(c.herokuAppsSchema, {});
  ok(c.herokuAppsSchema, { apiKey: 'k' });
});

test('oauth callbacks', () => {
  ok(c.oauthCallbackSchema, { state: 's'.repeat(10) });
  bad(c.oauthCallbackSchema, { state: 'short' });
  assert.equal(
    parse(c.githubSetupCallbackSchema, { installationId: '42', state: 's'.repeat(10) })
      .installationId,
    42,
  );
  bad(c.githubSetupCallbackSchema, { installationId: 0, state: 's'.repeat(10) });
});
