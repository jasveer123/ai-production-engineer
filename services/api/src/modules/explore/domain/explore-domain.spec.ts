import { decodeCursor, encodeCursor, resolveRange } from './range';
import { buildWaterfall } from './waterfall';

const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);
const span = (spanId: string, parentSpanId: string | null, start: number, durationMs = 10) => ({
  spanId,
  parentSpanId,
  start: at(start),
  durationMs,
});

describe('buildWaterfall', () => {
  it('nests children under parents in start order', () => {
    const w = buildWaterfall([
      span('c', 'a', 5),
      span('a', null, 0, 100),
      span('b', 'a', 2),
      span('d', 'b', 3),
    ]);
    expect(w.rows.map((r) => [r.span.spanId, r.depth, r.offsetMs])).toEqual([
      ['a', 0, 0],
      ['b', 1, 2],
      ['d', 2, 3],
      ['c', 1, 5],
    ]);
    expect(w.missingRoot).toBe(false);
    expect(w.orphanCount).toBe(0);
    expect(w.durationMs).toBe(100);
  });

  it('marks orphans and a missing root honestly', () => {
    const w = buildWaterfall([span('x', 'gone', 0), span('y', 'x', 1), span('x', 'gone', 0)]);
    expect(w.missingRoot).toBe(true);
    expect(w.orphanCount).toBe(1);
    expect(w.rows.map((r) => [r.span.spanId, r.depth, r.orphan])).toEqual([
      ['x', 0, true],
      ['y', 1, false],
    ]);
  });

  it('survives parent cycles', () => {
    const w = buildWaterfall([span('a', 'b', 0), span('b', 'a', 1)]);
    expect(w.rows).toHaveLength(2);
    expect(w.rows.map((r) => r.orphan)).toEqual([true, false]);
    expect(w.missingRoot).toBe(true);
  });
});

describe('resolveRange and cursors', () => {
  it('resolves relative and absolute ranges with limits', () => {
    const now = Date.UTC(2026, 0, 2);
    expect(resolveRange({ range: '15m' }, 14, now).from.getTime()).toBe(now - 15 * 60_000);
    expect(() => resolveRange({ range: '30d' }, 14, now)).toThrow('limited to 14 days');
    expect(() =>
      resolveRange({ from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' }, 14, now),
    ).toThrow('before the end');
  });

  it('round-trips cursors and rejects junk', () => {
    const c = { ts: '2026-01-01 00:00:00.123456+00', id: 42 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('["x",1]').toString('base64url'))).toBeNull();
  });
});
