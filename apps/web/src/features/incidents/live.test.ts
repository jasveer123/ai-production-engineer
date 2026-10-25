import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TimelineEntry } from '@ape/api-contracts';
import { groupTimeline, incidentLogWindow, isClosed, manualNextStatuses } from './live.ts';

test('manual moves follow the backend state machine and skip platform-driven steps', () => {
  assert.deepEqual(manualNextStatuses('detected'), [
    'investigating',
    'needs_attention',
    'closed_without_fix',
  ]);
  assert.deepEqual(manualNextStatuses('validation'), []);
  assert.deepEqual(manualNextStatuses('resolved'), ['needs_attention']);
});

test('closed statuses', () => {
  assert.equal(isClosed('resolved'), true);
  assert.equal(isClosed('closed_without_fix'), true);
  assert.equal(isClosed('monitoring'), false);
});

test('log window spans the incident with margins, and needs a service', () => {
  const w = incidentLogWindow({
    serviceName: 'demo-shop-api',
    firstSeenAt: '2026-10-24T12:00:00.000Z',
    lastSeenAt: '2026-10-24T12:10:00.000Z',
  });
  assert.deepEqual(w, {
    q: 'service:demo-shop-api',
    from: '2026-10-24T11:45:00.000Z',
    to: '2026-10-24T12:15:00.000Z',
  });
  assert.equal(incidentLogWindow({ serviceName: null, firstSeenAt: '', lastSeenAt: '' }), null);
});

test('timeline folds runs of the same error and keeps other steps apart', () => {
  const ev = (id: string, kind: 'error' | 'status_change', summary: string, at: string) =>
    ({
      kind,
      id,
      at,
      source: 'x',
      summary,
      traceId: null,
      sourceUrl: null,
      actorEmail: null,
      attributes: {},
    }) as TimelineEntry;
  const rows = groupTimeline([
    ev('3', 'error', 'boom', '2026-01-01T00:00:03Z'),
    ev('1', 'error', 'boom', '2026-01-01T00:00:01Z'),
    ev('2', 'status_change', 'investigating', '2026-01-01T00:00:02Z'),
    ev('4', 'error', 'boom', '2026-01-01T00:00:04Z'),
    ev('5', 'error', 'other', '2026-01-01T00:00:05Z'),
  ]);
  assert.deepEqual(
    rows.map((r) => `${r.entry.summary}x${r.count}`),
    ['boomx1', 'investigatingx1', 'boomx2', 'otherx1'],
  );
  assert.equal(rows[2]!.lastAt, '2026-01-01T00:00:04Z');
});
