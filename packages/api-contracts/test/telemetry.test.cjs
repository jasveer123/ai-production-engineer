const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, NOW, c } = require('./helpers.cjs');

test('createIngestTokenSchema needs a bounded name', () => {
  ok(c.createIngestTokenSchema, { name: 'ci' });
  bad(c.createIngestTokenSchema, { name: '' });
  bad(c.createIngestTokenSchema, { name: 'x'.repeat(81) });
});

test('logQuerySchema defaults and coerces', () => {
  const r = parse(c.logQuerySchema, {});
  assert.equal(r.q, '');
  assert.equal(r.limit, 100);
  assert.equal(parse(c.logQuerySchema, { before: '10' }).before, 10);
  ok(c.logQuerySchema, { from: NOW, to: NOW, limit: 500 });
  bad(c.logQuerySchema, { limit: 501 });
  bad(c.logQuerySchema, { before: 0 });
  bad(c.logQuerySchema, { from: 'yesterday' });
  bad(c.logQuerySchema, { q: 'x'.repeat(501) });
});

test('deploymentListQuerySchema defaults the limit and trims filters', () => {
  assert.equal(parse(c.deploymentListQuerySchema, {}).limit, 50);
  assert.equal(parse(c.deploymentListQuerySchema, { service: ' api ' }).service, 'api');
  bad(c.deploymentListQuerySchema, { service: '' });
  bad(c.deploymentListQuerySchema, { environment: 'x'.repeat(41) });
  bad(c.deploymentListQuerySchema, { limit: 201 });
});

test('log levels and ingest ways are non-empty and unique', () => {
  for (const list of [c.LOG_LEVELS, c.INGEST_WAYS]) {
    assert.ok(list.length > 0);
    assert.equal(new Set(list).size, list.length);
  }
});
