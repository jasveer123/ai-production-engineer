import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignableRoles, hasRole, safeNext } from './roles.ts';

test('role ranks', () => {
  assert.equal(hasRole('admin', 'engineer'), true);
  assert.equal(hasRole('viewer', 'engineer'), false);
  assert.deepEqual(assignableRoles('admin'), ['admin', 'engineer', 'viewer']);
  assert.deepEqual(assignableRoles('engineer'), []);
});

test('safeNext only allows same-origin paths', () => {
  assert.equal(safeNext('/integrations/'), '/integrations/');
  assert.equal(safeNext('//evil.com'), '/');
  assert.equal(safeNext('https://evil.com'), '/');
  assert.equal(safeNext('/\\evil.com'), '/');
  assert.equal(safeNext('/login/'), '/');
  assert.equal(safeNext(null), '/');
});
