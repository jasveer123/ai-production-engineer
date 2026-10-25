import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEND_WAYS, stepsFor } from './ways.ts';

const ctx = {
  ingestUrl: 'https://ingest.example.com',
  token: 'ape_live_abc',
  syslog: { host: 'logs.example.com', port: 6514, tls: true },
};

test('every way has steps with the workspace URL and token filled in', () => {
  for (const way of SEND_WAYS) {
    const steps = stepsFor(way.slug, ctx);
    assert.ok(steps.length > 0, way.slug);
    const text = JSON.stringify(steps);
    assert.ok(text.includes('ape_live_abc'), `${way.slug} has the token`);
  }
});

test('Heroku drain URL carries the token as basic-auth password', () => {
  const heroku = stepsFor('log-drain', ctx).find((s) => s.title === 'Heroku')!;
  assert.match(
    heroku.snippets![0]!.code,
    /https:\/\/ape:ape_live_abc@ingest\.example\.com\/v1\/drain\?service=my-app/,
  );
});

test('Render step only when syslog is enabled', () => {
  assert.ok(stepsFor('log-drain', ctx).some((s) => s.title === 'Render'));
  assert.ok(!stepsFor('log-drain', { ...ctx, syslog: null }).some((s) => s.title === 'Render'));
});
