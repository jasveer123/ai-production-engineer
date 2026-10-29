const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, UUID, c } = require('./helpers.cjs');

test('heartbeat is the only source kind that is not a webhook', () => {
  assert.deepEqual(
    c.ALERT_SOURCE_KINDS.filter((k) => !c.WEBHOOK_ALERT_KINDS.includes(k)),
    ['heartbeat'],
  );
  for (const kind of c.ALERT_SOURCE_KINDS) assert.ok(c.ALERT_SOURCE_LABELS[kind]);
});

test('createAlertSourceSchema: webhook kinds need only a name', () => {
  for (const kind of c.WEBHOOK_ALERT_KINDS) ok(c.createAlertSourceSchema, { kind, name: 'n' });
  bad(c.createAlertSourceSchema, { kind: 'http', name: '' });
  bad(c.createAlertSourceSchema, { kind: 'pagerduty', name: 'n' });
});

test('createAlertSourceSchema: heartbeat needs an interval and defaults the grace', () => {
  const r = parse(c.createAlertSourceSchema, {
    kind: 'heartbeat',
    name: 'cron',
    intervalSeconds: 60,
  });
  assert.equal(r.graceSeconds, 60);
  bad(c.createAlertSourceSchema, { kind: 'heartbeat', name: 'cron' });
  bad(c.createAlertSourceSchema, { kind: 'heartbeat', name: 'cron', intervalSeconds: 29 });
  bad(c.createAlertSourceSchema, {
    kind: 'heartbeat',
    name: 'cron',
    intervalSeconds: 7 * 86400 + 1,
  });
  bad(c.createAlertSourceSchema, {
    kind: 'heartbeat',
    name: 'cron',
    intervalSeconds: 60,
    graceSeconds: 86401,
  });
});

test('alertConditionSchema: field format and operator rules', () => {
  ok(c.alertConditionSchema, { field: 'title', op: 'contains', value: 'db' });
  ok(c.alertConditionSchema, { field: 'label.team', op: 'eq', value: 'sre' });
  ok(c.alertConditionSchema, { field: 'severity', op: 'exists' });
  ok(c.alertConditionSchema, { field: 'status', op: 'not_exists' });
  bad(c.alertConditionSchema, { field: 'host', op: 'eq', value: 'a' });
  bad(c.alertConditionSchema, { field: 'title', op: 'eq' });
  bad(c.alertConditionSchema, { field: 'title', op: 'nope', value: 'a' });
});

test('alertConditionSchema rejects invalid regular expressions', () => {
  ok(c.alertConditionSchema, { field: 'title', op: 'regex', value: '^db-\\d+$' });
  bad(c.alertConditionSchema, { field: 'title', op: 'regex', value: '(' });
  bad(c.alertConditionSchema, { field: 'title', op: 'regex' });
});

test('alertRouteSchema applies defaults', () => {
  const r = parse(c.alertRouteSchema, { name: 'default' });
  assert.deepEqual(
    { ...r },
    {
      name: 'default',
      enabled: true,
      sourceIds: [],
      conditions: [],
      groupBy: [],
      createIncident: true,
      incidentSeverity: null,
    },
  );
  bad(c.alertRouteSchema, { name: '' });
  bad(c.alertRouteSchema, { name: 'r', sourceIds: ['x'] });
  bad(c.alertRouteSchema, { name: 'r', groupBy: Array(6).fill('a') });
  bad(c.alertRouteSchema, { name: 'r', incidentSeverity: 'urgent' });
});

test('updateAlertRouteSchema is partial; reorder takes uuids', () => {
  ok(c.updateAlertRouteSchema, {});
  ok(c.updateAlertRouteSchema, { enabled: false });
  ok(c.reorderAlertRoutesSchema, { ids: [UUID] });
  bad(c.reorderAlertRoutesSchema, { ids: ['x'] });
  bad(c.reorderAlertRoutesSchema, { ids: Array(201).fill(UUID) });
});

test('alertPreviewSchema and alertListQuerySchema', () => {
  ok(c.alertPreviewSchema, { sourceId: UUID, payload: { any: 'thing' } });
  bad(c.alertPreviewSchema, { sourceId: 'x', payload: {} });
  assert.equal(parse(c.alertListQuerySchema, {}).limit, 100);
  for (const status of c.ALERT_STATES) ok(c.alertListQuerySchema, { status });
  bad(c.alertListQuerySchema, { status: 'open' });
  bad(c.alertListQuerySchema, { limit: 201 });
});
