import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeConditions, moveRoute, parseList, setupSnippet } from './setup.ts';

test('every setup snippet carries the url and token', () => {
  const kinds = [
    'http',
    'alertmanager',
    'grafana',
    'sentry',
    'datadog',
    'betterstack',
    'cloudwatch',
    'elasticsearch',
    'heartbeat',
  ] as const;
  for (const kind of kinds) {
    const s = setupSnippet(kind, 'https://api/ingest/x', 'ape_alert_secret');
    assert.ok(s.includes('https://api/ingest/x'), kind);
    assert.ok(s.includes('ape_alert_secret'), kind);
  }
});

test('describes conditions in words', () => {
  assert.equal(describeConditions([]), 'every alert');
  assert.equal(
    describeConditions([
      { field: 'severity', op: 'eq', value: 'critical' },
      { field: 'label.service', op: 'exists' },
    ]),
    'severity is "critical" and label.service is set',
  );
});

test('moves a route up or down and stays put at the ends', () => {
  const r = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(moveRoute(r, 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveRoute(r, 1, 1), ['a', 'c', 'b']);
  assert.deepEqual(moveRoute(r, 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveRoute(r, 2, 1), ['a', 'b', 'c']);
});

test('parses a comma list', () => {
  assert.deepEqual(parseList(' service, env , ,'), ['service', 'env']);
});
