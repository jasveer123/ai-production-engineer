import { dailySeries, heatmap, inWindow, overlapSeconds, responseTimes } from './metrics';

const d = (iso: string) => new Date(iso);

describe('report metrics', () => {
  const rows = [
    {
      startedAt: d('2026-11-10T10:00:00Z'),
      acknowledgedAt: d('2026-11-10T10:02:00Z'),
      resolvedAt: d('2026-11-10T10:30:00Z'),
      isResolved: true,
    },
    {
      startedAt: d('2026-11-11T22:00:00Z'),
      acknowledgedAt: d('2026-11-11T22:06:00Z'),
      resolvedAt: null,
      isResolved: false,
    },
    {
      startedAt: d('2026-11-12T03:00:00Z'),
      acknowledgedAt: null,
      resolvedAt: null,
      isResolved: true,
    },
  ];

  it('computes MTTA and MTTR only from recorded lifecycle times', () => {
    expect(responseTimes(rows)).toEqual({
      acknowledged: 2,
      resolved: 2,
      mttaSeconds: 240,
      mttrSeconds: 1800,
      unacknowledged: 1,
      unresolved: 1,
      missingTimestamps: 1,
    });
  });

  it('returns null averages when nothing qualifies', () => {
    expect(responseTimes([]).mttaSeconds).toBeNull();
  });

  it('places incidents on a local weekday/hour heatmap', () => {
    const grid = heatmap(rows, 'Asia/Kolkata');
    expect(grid[1]![15]).toBe(1);
    expect(grid[3]![8]).toBe(1);
  });

  it('filters business hours and weekdays in the given timezone', () => {
    const f = { timezone: 'UTC', businessHours: true, weekdays: false };
    expect(inWindow(d('2026-11-10T10:00:00Z'), f)).toBe(true);
    expect(inWindow(d('2026-11-10T20:00:00Z'), f)).toBe(false);
    expect(
      inWindow(d('2026-11-14T10:00:00Z'), { ...f, businessHours: false, weekdays: true }),
    ).toBe(false);
  });

  it('builds a gap-free daily series', () => {
    const series = dailySeries(rows, d('2026-11-10T00:00:00Z'), d('2026-11-13T00:00:00Z'), 'UTC');
    expect(series.map((s) => s.started)).toEqual([1, 1, 1, 0]);
    expect(series[0]!.resolved).toBe(1);
  });

  it('clips downtime to the report range', () => {
    expect(
      overlapSeconds(
        d('2026-11-09T23:00:00Z'),
        d('2026-11-10T01:00:00Z'),
        d('2026-11-10T00:00:00Z'),
        d('2026-11-11T00:00:00Z'),
        new Date(),
      ),
    ).toBe(3600);
  });
});
