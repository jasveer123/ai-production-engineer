import assert from 'node:assert/strict';
import { test } from 'vitest';
import { bucketLogs, filterLogs, parseLogQuery } from './query.ts';
import type { LogLine } from './types.ts';

const line = (over: Partial<LogLine>): LogLine => ({
  id: 'x',
  at: '2026-10-20T10:42:00.000Z',
  level: 'info',
  service: 'checkout-api',
  message: 'POST /checkout 200',
  source: 'OpenTelemetry',
  ...over,
});

test('parses keys, phrases and plain words', () => {
  assert.deepEqual(
    parseLogQuery('level:error service:Checkout-API trace:4BF9 "percent off" coupon'),
    {
      levels: ['error'],
      services: ['checkout-api'],
      traceIds: ['4bf9'],
      text: ['percent off', 'coupon'],
    },
  );
});

test('an invalid level or unknown key stays as text instead of disappearing', () => {
  const q = parseLogQuery('level:fatal env:prod');
  assert.deepEqual(q.levels, []);
  assert.deepEqual(q.text, ['level:fatal', 'env:prod']);
});

test('empty input matches everything', () => {
  const lines = [line({ id: 'a' }), line({ id: 'b', level: 'error' })];
  assert.equal(filterLogs(lines, '   ').length, 2);
});

test('filters combine with AND, values within a key with OR', () => {
  const lines = [
    line({
      id: 'a',
      level: 'error',
      message: "Cannot read properties of undefined (reading 'percentOff')",
    }),
    line({ id: 'b', level: 'warn', message: 'coupon lookup returned no rows' }),
    line({ id: 'c', level: 'error', service: 'nginx-edge', message: 'upstream timeout' }),
  ];
  assert.deepEqual(
    filterLogs(lines, 'level:error service:checkout-api').map((l) => l.id),
    ['a'],
  );
  assert.deepEqual(
    filterLogs(lines, 'level:error level:warn service:checkout-api').map((l) => l.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    filterLogs(lines, '"percentoff"').map((l) => l.id),
    ['a'],
  );
});

test('trace filter matches by prefix and skips lines without a trace', () => {
  const lines = [line({ id: 'a', traceId: '4bf92f3577b34da6' }), line({ id: 'b' })];
  assert.deepEqual(
    filterLogs(lines, 'trace:4bf92f35').map((l) => l.id),
    ['a'],
  );
});

test('bucketLogs counts totals and errors and ignores lines outside the range', () => {
  const lines = [
    line({ at: '2026-10-20T10:00:10Z' }),
    line({ at: '2026-10-20T10:00:50Z', level: 'error' }),
    line({ at: '2026-10-20T10:01:30Z', level: 'error' }),
    line({ at: '2026-10-20T09:59:00Z' }),
    line({ at: '2026-10-20T10:05:00Z' }),
  ];
  const buckets = bucketLogs(lines, 60_000, '2026-10-20T10:00:00Z', 2);
  assert.deepEqual(
    buckets.map((b) => [b.total, b.errors]),
    [
      [2, 1],
      [1, 1],
    ],
  );
});
