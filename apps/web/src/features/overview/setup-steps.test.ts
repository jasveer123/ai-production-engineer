import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupSteps } from './setup-steps.ts';

const empty = {
  githubConnected: false,
  sendingServices: [],
  servicesSetUp: 0,
  servicesWithoutRepo: 0,
  discoveredNotSetUp: [],
  incidents: 0,
};

test('a new workspace starts at connecting code', () => {
  assert.deepEqual(
    setupSteps(empty).map((s) => s.state),
    ['current', 'todo', 'todo', 'todo'],
  );
});

test('the first unfinished step is current, even when later ones are done', () => {
  const steps = setupSteps({
    ...empty,
    githubConnected: true,
    sendingServices: ['a', 'b', 'c', 'd'],
    discoveredNotSetUp: ['d'],
    servicesSetUp: 3,
    incidents: 2,
  });
  assert.deepEqual(
    steps.map((s) => s.state),
    ['done', 'done', 'current', 'done'],
  );
  assert.match(steps[1]!.detail, /a, b, c and 1 more/);
});

test('everything done', () => {
  const steps = setupSteps({
    githubConnected: true,
    sendingServices: ['a'],
    servicesSetUp: 1,
    servicesWithoutRepo: 0,
    discoveredNotSetUp: [],
    incidents: 1,
  });
  assert.ok(steps.every((s) => s.state === 'done'));
});
