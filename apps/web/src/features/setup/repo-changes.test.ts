import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planRepoChanges } from './repo-changes.ts';

const account = (installationId: number, connected: boolean, selected: string[]) => ({
  installationId,
  account: `acct${installationId}`,
  accountType: 'User',
  avatarUrl: '',
  repositorySelection: 'selected' as const,
  repositories: [],
  selected,
  connected,
  integrationId: connected ? `int${installationId}` : null,
});

test('a new account with ticked repos is connected', () => {
  const plan = planRepoChanges([account(1, false, ['a/x', 'a/y'])], { 1: ['a/x'] });
  assert.equal(plan.toConnect.length, 1);
  assert.equal(plan.added, 1);
  assert.equal(plan.toDisconnect.length, 0);
});

test('unticking a saved repo removes it; untouched accounts are left alone', () => {
  const plan = planRepoChanges([account(1, true, ['a/x', 'a/y']), account(2, true, ['b/z'])], {
    1: ['a/x'],
    2: ['b/z'],
  });
  assert.deepEqual(
    plan.toConnect.map((c) => c.account.installationId),
    [1],
  );
  assert.equal(plan.removed, 1);
});

test('a connected account with nothing ticked is disconnected', () => {
  const plan = planRepoChanges([account(1, true, ['a/x'])], { 1: [] });
  assert.equal(plan.toConnect.length, 0);
  assert.equal(plan.toDisconnect.length, 1);
  assert.equal(plan.removed, 1);
});
