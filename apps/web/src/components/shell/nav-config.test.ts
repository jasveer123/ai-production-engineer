import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isActive } from './nav-config.ts';

test('overview is active only on the root', () => {
  assert.equal(isActive('/', '/'), true);
  assert.equal(isActive('/', '/incidents/'), false);
});

test('sections stay active on their sub-pages, with or without a trailing slash', () => {
  assert.equal(isActive('/incidents/', '/incidents'), true);
  assert.equal(isActive('/incidents/', '/incidents/inc-checkout-coupon/logs/'), true);
  assert.equal(isActive('/integrations/', '/integrations/opentelemetry'), true);
});

test('a prefix of another word does not match', () => {
  assert.equal(isActive('/logs/', '/logsearch/'), false);
});
