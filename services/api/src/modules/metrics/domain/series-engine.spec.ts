import { metricsToBatch } from '../../../ingest/collector/domain/otlp-metrics';
import type { MetricHistogram } from '../../../core/db/schema';
import { histogramQuantile, bucketsOf } from './histogram';
import { aggregateSeries, type Grid, type PointRow } from './series-engine';

const T0 = Date.UTC(2026, 10, 14, 12, 0, 0);
const grid: Grid = { from: T0, bucketMs: 60_000, buckets: 4 };
const at = (sec: number) => new Date(T0 + sec * 1000);

const counter = (seriesKey: string, sec: number, value: number, extra: Partial<PointRow> = {}) =>
  ({
    ts: at(sec),
    seriesKey,
    group: '',
    kind: 'counter',
    temporality: 'cumulative',
    monotonic: true,
    startTs: null,
    value,
    histogram: null,
    ...extra,
  }) satisfies PointRow;

const explicit = (bounds: number[], counts: number[], sum: number): MetricHistogram => ({
  type: 'explicit',
  count: counts.reduce((a, b) => a + b, 0),
  sum,
  min: null,
  max: null,
  bounds,
  counts,
});

describe('histogram ingestion (G07)', () => {
  const req = (counts: number[], sum: number) => ({
    resourceMetrics: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'api' } }] },
        scopeMetrics: [
          {
            scope: { name: 'otel.http', version: '1.0' },
            metrics: [
              {
                name: 'http.server.duration',
                unit: 'ms',
                histogram: {
                  aggregationTemporality: 1,
                  dataPoints: [
                    {
                      startTimeUnixNano: String(BigInt(T0) * 1_000_000n),
                      timeUnixNano: String(BigInt(T0 + 30_000) * 1_000_000n),
                      count: '100',
                      sum,
                      bucketCounts: counts.map(String),
                      explicitBounds: [10, 50, 100, 1000],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  });

  it('keeps buckets, temporality, scope and start time', () => {
    const batch = metricsToBatch(req([10, 80, 10, 0, 0], 4000));
    const p = batch.points[0]!;
    expect(p.kind).toBe('histogram');
    expect(p.temporality).toBe('delta');
    expect(p.scope).toBe('otel.http@1.0');
    expect(p.startTs?.getTime()).toBe(T0);
    expect(p.histogram).toMatchObject({ bounds: [10, 50, 100, 1000], counts: [10, 80, 10, 0, 0] });
    expect(p.seriesKey).toHaveLength(32);
  });

  it('two histograms with equal means and different tails give different p99', () => {
    const narrow = metricsToBatch(req([0, 100, 0, 0, 0], 4000)).points[0]!;
    const wide = metricsToBatch(req([60, 38, 0, 0, 2], 4000)).points[0]!;
    expect(narrow.histogram!.sum! / narrow.value).toBe(wide.histogram!.sum! / wide.value);
    const p99 = (h: MetricHistogram) => histogramQuantile(0.99, bucketsOf(h));
    expect(p99(narrow.histogram!)).toBeCloseTo(49.6);
    expect(p99(wide.histogram!)).toBe(1000);
  });

  it('rejects malformed bucket counts and reports a reason', () => {
    const batch = metricsToBatch(req([1, 2], 10));
    expect(batch.points).toHaveLength(0);
    expect(batch.rejected).toBe(1);
    expect(batch.rejectReason).toMatch(/invalid_point/);
  });
});

describe('aggregateSeries rate and increase (G08)', () => {
  it('handles a counter reset inside a series', () => {
    const rows = [
      counter('a', -10, 100),
      counter('a', 20, 160),
      counter('a', 50, 10),
      counter('a', 80, 40),
    ];
    const out = aggregateSeries(rows, grid, 'increase').get('')!;
    expect(out[0]).toBe(60 + 10);
    expect(out[1]).toBe(30);
    expect(out[2]).toBeNull();
  });

  it('computes per-series increments before summing across series', () => {
    const rows = [
      counter('a', 0, 1000),
      counter('a', 30, 1060),
      counter('b', 0, 5),
      counter('b', 30, 11),
    ];
    const rate = aggregateSeries(rows, grid, 'rate').get('')!;
    expect(rate[0]).toBeCloseTo(66 / 60);
  });

  it('keeps sparse buckets null instead of zero', () => {
    const rows = [counter('a', 0, 1), counter('a', 150, 4)];
    const out = aggregateSeries(rows, grid, 'increase').get('')!;
    expect(out).toEqual([null, null, 3, null]);
  });

  it('treats a changed start time as a reset', () => {
    const rows = [
      counter('a', 0, 50, { startTs: at(-100) }),
      counter('a', 30, 70, { startTs: at(10) }),
    ];
    expect(aggregateSeries(rows, grid, 'increase').get('')![0]).toBe(70);
  });

  it('sums delta temporality points as increments', () => {
    const rows = [
      counter('a', 0, 5, { temporality: 'delta' }),
      counter('a', 30, 7, { temporality: 'delta' }),
    ];
    expect(aggregateSeries(rows, grid, 'increase').get('')![0]).toBe(12);
  });

  it('counts a counter born inside the window from its start time', () => {
    const rows = [counter('a', 30, 9, { startTs: at(5) })];
    expect(aggregateSeries(rows, grid, 'increase').get('')![0]).toBe(9);
  });
});

describe('aggregateSeries quantiles', () => {
  const hist = (sec: number, counts: number[], temporality = 'cumulative', key = 'h') =>
    ({
      ...counter(
        key,
        sec,
        counts.reduce((a, b) => a + b, 0),
      ),
      kind: 'histogram',
      temporality,
      histogram: explicit([100, 200, 400], counts, 0),
    }) satisfies PointRow;

  it('interpolates p95 from cumulative bucket increments', () => {
    const rows = [hist(0, [10, 0, 0, 0]), hist(30, [10, 90, 10, 0])];
    const p95 = aggregateSeries(rows, grid, 'p95').get('')![0]!;
    expect(p95).toBeGreaterThan(200);
    expect(p95).toBeLessThan(400);
  });

  it('merges delta histograms across series', () => {
    const rows = [hist(0, [100, 0, 0, 0], 'delta', 'x'), hist(10, [0, 0, 0, 100], 'delta', 'y')];
    expect(aggregateSeries(rows, grid, 'p50').get('')![0]).toBe(100);
    expect(aggregateSeries(rows, grid, 'p99').get('')![0]).toBe(400);
  });

  it('uses sample quantiles for gauges, never the mean', () => {
    const rows = [1, 2, 3, 100].map((v, i) => ({
      ...counter(`g${i}`, i, v),
      kind: 'gauge',
      temporality: null,
      monotonic: null,
    }));
    const out = aggregateSeries(rows, grid, 'p99').get('')![0]!;
    expect(out).toBeGreaterThan(90);
    expect(aggregateSeries(rows, grid, 'avg').get('')![0]).toBe(26.5);
  });
});
