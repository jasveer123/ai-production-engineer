import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ANSWER, FINDER_OPTIONS, recommend } from './finder.ts';

test('every answer has a recommendation with a link', () => {
  for (const option of FINDER_OPTIONS) {
    const rec = recommend(option.value);
    assert.ok(rec.title.startsWith('Use Way'), option.value);
    assert.ok(rec.href.startsWith('/integrations/'), option.value);
  }
});

test('answers map to the matching way', () => {
  assert.equal(recommend('otel').href, '/integrations/opentelemetry/');
  assert.equal(recommend('files').href, '/integrations/server-agent/');
  assert.equal(recommend('tool').href, '/integrations/tools/');
});

test('the default answer is one of the options', () => {
  assert.ok(FINDER_OPTIONS.some((o) => o.value === DEFAULT_ANSWER));
});
