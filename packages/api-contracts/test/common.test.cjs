const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, UUID, NOW, c } = require('./helpers.cjs');

test('roleSchema accepts only known roles', () => {
  for (const role of c.ROLES) ok(c.roleSchema, role);
  bad(c.roleSchema, 'superuser');
});

test('apiErrorSchema requires a correlation id', () => {
  ok(c.apiErrorSchema, { code: 'X', message: 'm', correlationId: 'c' });
  bad(c.apiErrorSchema, { code: 'X', message: 'm' });
});

test('uuidSchema and isoDateTimeSchema', () => {
  ok(c.uuidSchema, UUID);
  bad(c.uuidSchema, 'nope');
  ok(c.isoDateTimeSchema, NOW);
  bad(c.isoDateTimeSchema, 'yesterday');
});

test('nameSchema trims, bounds and reports the custom message', () => {
  assert.equal(parse(c.nameSchema(5), ' ab '), 'ab');
  bad(c.nameSchema(5), '   ');
  bad(c.nameSchema(5), 'abcdef');
  const r = c.nameSchema(5, 'Need a name').safeParse('');
  assert.equal(r.error.issues[0].message, 'Need a name');
});

test('optionalText is optional and bounded', () => {
  ok(c.optionalText(3), undefined);
  ok(c.optionalText(3), 'abc');
  bad(c.optionalText(3), 'abcd');
});

test('secretSchema, urlSchema, boundedUrlSchema', () => {
  ok(c.secretSchema, 'x');
  bad(c.secretSchema, '');
  bad(c.secretSchema, 'x'.repeat(4001));
  ok(c.urlSchema, 'https://a.co');
  bad(c.urlSchema, 'a.co');
  bad(c.boundedUrlSchema, `https://a.co/${'x'.repeat(500)}`);
});

test('repoFullNameSchema needs owner/repo', () => {
  ok(c.repoFullNameSchema, 'acme/api');
  bad(c.repoFullNameSchema, 'acme');
  bad(c.repoFullNameSchema, 'a/b/c');
});

test('coercedInt coerces, bounds and defaults', () => {
  const s = c.coercedInt(10, 5);
  assert.equal(parse(s, undefined), 5);
  assert.equal(parse(s, '7'), 7);
  bad(s, 0);
  bad(s, 11);
  bad(s, 1.5);
});

test('pagedQuery has a cursor and a bounded limit', () => {
  const s = c.pagedQuery(100, 50);
  assert.deepEqual(parse(s, {}), { limit: 50 });
  ok(s, { before: NOW, limit: '100' });
  bad(s, { limit: 101 });
  bad(s, { before: 'x' });
});
