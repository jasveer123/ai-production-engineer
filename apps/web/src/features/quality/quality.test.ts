import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIN_SAMPLE, parseDays, ratio } from './quality.ts';

test('days param accepts only offered ranges', () => {
  assert.equal(parseDays(null), 30);
  assert.equal(parseDays('7'), 7);
  assert.equal(parseDays('90'), 90);
  assert.equal(parseDays('400'), 30);
  assert.equal(parseDays('abc'), 30);
});

test('ratio never invents a rate from too little data', () => {
  assert.deepEqual(ratio(0, 0), { kind: 'none' });
  assert.deepEqual(ratio(1, 2), { kind: 'few', part: 1, whole: 2 });
  assert.deepEqual(ratio(3, MIN_SAMPLE), { kind: 'rate', part: 3, whole: 5, value: 0.6 });
});
