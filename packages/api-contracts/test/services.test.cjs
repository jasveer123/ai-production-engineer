const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, c } = require('./helpers.cjs');

test('createServiceSchema validates repository names and defaults the branch', () => {
  const s = parse(c.createServiceSchema, {
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
  bad(c.createServiceSchema, { name: 'api', environment: 'x'.repeat(41) });
  ok(c.createServiceSchema, { name: 'api', environment: 'prod', repositoryFullName: null });
});

test('updateServiceSchema accepts partial input', () => {
  ok(c.updateServiceSchema, {});
  ok(c.updateServiceSchema, { name: 'renamed' });
  bad(c.updateServiceSchema, { name: '' });
});

test('serviceValueSchema normalises currency and rejects bad values', () => {
  assert.equal(parse(c.serviceValueSchema, { valuePerRequest: 2 }).currency, 'USD');
  assert.equal(
    parse(c.serviceValueSchema, { valuePerRequest: 2, currency: ' inr ' }).currency,
    'INR',
  );
  ok(c.serviceValueSchema, { valuePerRequest: null });
  bad(c.serviceValueSchema, { valuePerRequest: 0 });
  bad(c.serviceValueSchema, { valuePerRequest: 2_000_000 });
  bad(c.serviceValueSchema, { valuePerRequest: 1, currency: 'US' });
});

test('businessImpactQuerySchema defaults to 7 days and caps at 90', () => {
  assert.equal(parse(c.businessImpactQuerySchema, {}).days, 7);
  assert.equal(parse(c.businessImpactQuerySchema, { days: '30' }).days, 30);
  bad(c.businessImpactQuerySchema, { days: 91 });
  bad(c.businessImpactQuerySchema, { days: 0 });
});
