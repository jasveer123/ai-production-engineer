import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetShare, parseLimits } from './limits.ts';

test('budget share is null without a budget and over 1 when exceeded', () => {
  assert.equal(budgetShare(5, null), null);
  assert.equal(budgetShare(5, 20), 0.25);
  assert.equal(budgetShare(30, 20), 1.5);
  assert.equal(budgetShare(0, 0), 1);
});

test('empty fields mean no limit; bad numbers are rejected with a message', () => {
  assert.deepEqual(parseLimits('', ''), {
    monthlyAiBudgetUsd: null,
    maxConcurrentInvestigations: null,
  });
  assert.deepEqual(parseLimits('25.5', '3'), {
    monthlyAiBudgetUsd: 25.5,
    maxConcurrentInvestigations: 3,
  });
  assert.equal(typeof parseLimits('-1', ''), 'string');
  assert.equal(typeof parseLimits('', '0'), 'string');
  assert.equal(typeof parseLimits('', '1.5'), 'string');
  assert.equal(typeof parseLimits('abc', ''), 'string');
});
