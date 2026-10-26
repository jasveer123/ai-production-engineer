import assert from 'node:assert/strict';
import { test } from 'vitest';
import { cleanRule, describeRule, moveItem } from './severity-rules.ts';

test('cleanRule trims conditions and drops empty ones', () => {
  assert.deepEqual(
    cleanRule({ environment: ' production ', serviceName: '  ', errorType: '', severity: 'high' }),
    { environment: 'production', severity: 'high' },
  );
});

test('describeRule lists conditions, or says it matches anything', () => {
  assert.equal(
    describeRule({ environment: 'production', errorType: 'TypeError', severity: 'high' }),
    'production · TypeError',
  );
  assert.equal(describeRule({ serviceName: ' ', severity: 'low' }), 'Any incident');
});

test('moveItem swaps neighbours and ignores moves past the edges', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
  const list = ['a', 'b'];
  assert.equal(moveItem(list, 0, -1), list);
  assert.equal(moveItem(list, 1, 1), list);
});
