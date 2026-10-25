import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetShare } from './limits.ts';

test('budget share is null without a budget and over 1 when exceeded', () => {
  assert.equal(budgetShare(5, null), null);
  assert.equal(budgetShare(5, 20), 0.25);
  assert.equal(budgetShare(30, 20), 1.5);
  assert.equal(budgetShare(0, 0), 1);
});
