import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PullRequestView } from '@ape/api-contracts';
import { countByStatus, filterPulls, parsePrFilter } from './fixes.ts';

const pr = (id: string, status: PullRequestView['status']) => ({ id, status }) as PullRequestView;
const pulls = [pr('a', 'open'), pr('b', 'merged'), pr('c', 'open'), pr('d', 'closed')];

test('unknown or missing status filters fall back to all', () => {
  assert.equal(parsePrFilter(null), 'all');
  assert.equal(parsePrFilter('bogus'), 'all');
  assert.equal(parsePrFilter('merged'), 'merged');
});

test('filters and counts pull requests by status', () => {
  assert.deepEqual(
    filterPulls(pulls, 'open').map((p) => p.id),
    ['a', 'c'],
  );
  assert.equal(filterPulls(pulls, 'all').length, 4);
  assert.deepEqual(countByStatus(pulls), { all: 4, open: 2, merged: 1, closed: 1 });
  assert.deepEqual(countByStatus([]), { all: 0, open: 0, merged: 0, closed: 0 });
});
