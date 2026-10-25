const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../dist');

const ok = (schema, value) => assert.equal(schema.safeParse(value).success, true);
const bad = (schema, value) => assert.equal(schema.safeParse(value).success, false);

test('registerSchema normalises email and enforces password length', () => {
  const r = c.registerSchema.parse({
    name: ' Ada ',
    email: ' ADA@Example.com ',
    password: 'x'.repeat(10),
  });
  assert.equal(r.email, 'ada@example.com');
  assert.equal(r.name, 'Ada');
  bad(c.registerSchema, { name: 'Ada', email: 'ada@example.com', password: 'short' });
  bad(c.registerSchema, { name: 'Ada', email: 'not-an-email', password: 'x'.repeat(10) });
  bad(c.registerSchema, { name: '', email: 'ada@example.com', password: 'x'.repeat(10) });
});

test('loginSchema requires a password but not the minimum length', () => {
  ok(c.loginSchema, { email: 'a@b.co', password: 'x' });
  bad(c.loginSchema, { email: 'a@b.co', password: '' });
});

test('roleSchema accepts only known roles', () => {
  for (const role of c.ROLES) ok(c.roleSchema, role);
  bad(c.roleSchema, 'superuser');
});

test('createServiceSchema validates repository names and defaults the branch', () => {
  const s = c.createServiceSchema.parse({
    name: 'api',
    environment: 'prod',
    repositoryFullName: 'acme/api',
  });
  assert.equal(s.defaultBranch, 'main');
  bad(c.createServiceSchema, {
    name: 'api',
    environment: 'prod',
    repositoryFullName: 'not a repo',
  });
  bad(c.createServiceSchema, { name: '', environment: 'prod' });
});

test('createIncidentSchema defaults severity and rejects short titles', () => {
  assert.equal(c.createIncidentSchema.parse({ title: 'Checkout is down' }).severity, 'medium');
  bad(c.createIncidentSchema, { title: 'ab' });
  bad(c.createIncidentSchema, { title: 'Checkout is down', serviceId: 'nope' });
});

test('transitionIncidentSchema needs a valid status and a positive version', () => {
  ok(c.transitionIncidentSchema, { to: 'resolved', expectedVersion: 2 });
  bad(c.transitionIncidentSchema, { to: 'exploded', expectedVersion: 2 });
  bad(c.transitionIncidentSchema, { to: 'resolved', expectedVersion: 0 });
});

test('incident transitions never leave a closed state except by listing it', () => {
  for (const status of c.INCIDENT_STATUSES) assert.ok(c.INCIDENT_TRANSITIONS[status]);
  for (const to of c.INCIDENT_TRANSITIONS.detected) assert.ok(c.INCIDENT_STATUSES.includes(to));
});

test('createNotificationChannelSchema discriminates on kind', () => {
  const base = { name: 'ops', events: [c.NOTIFICATION_EVENTS[0]] };
  const slack = {
    kind: 'slack',
    webhookUrl: 'https://hooks.slack.com/services/T000/B000/XXXX',
    ...base,
  };
  assert.equal(c.createNotificationChannelSchema.parse(slack).minSeverity, 'low');
  bad(c.createNotificationChannelSchema, { ...slack, webhookUrl: 'https://evil.example.com/hook' });
  ok(c.createNotificationChannelSchema, {
    kind: 'webhook',
    url: 'https://example.com/hook',
    ...base,
  });
  bad(c.createNotificationChannelSchema, {
    kind: 'webhook',
    url: 'https://example.com/hook',
    name: 'ops',
    events: [],
  });
  bad(c.createNotificationChannelSchema, { kind: 'pager', ...base });
});

test('createIngestTokenSchema requires a name', () => {
  ok(c.createIngestTokenSchema, { name: 'prod' });
  bad(c.createIngestTokenSchema, { name: '  ' });
});

test('logQuerySchema and deploymentListQuerySchema accept empty queries', () => {
  ok(c.logQuerySchema, {});
  ok(c.deploymentListQuerySchema, {});
  bad(c.deploymentListQuerySchema, { limit: 1000 });
});

test('fixActionSchema accepts only known actions', () => {
  for (const action of c.FIX_ACTIONS) ok(c.fixActionSchema, { action });
  bad(c.fixActionSchema, { action: 'merge_to_main' });
});

test('apiErrorSchema requires a correlation id', () => {
  ok(c.apiErrorSchema, { code: 'not_found', message: 'x', correlationId: 'abc' });
  bad(c.apiErrorSchema, { code: 'not_found', message: 'x' });
});
