import { jsonLogsToBatch, recordToLog } from './formats';
import { jsonMetricsToBatch } from './json-metrics';
import { tracesToBatch } from './otlp';
import { metricsToBatch, otlpPartialSuccess } from './otlp-metrics';
import { prometheusTextToBatch } from './prometheus';
import { decodeMetrics } from './protobuf';
import { Writer } from './protobuf-writer';

describe('OTLP partial success (G09)', () => {
  it('reports rejected spans with a reason', () => {
    const batch = tracesToBatch({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: '0af7651916cd43dd8448eb211c80319c',
                  spanId: 'b7ad6b7169203331',
                  name: 'ok',
                },
                { traceId: 'nope', spanId: 'x', name: 'bad' },
              ],
            },
          ],
        },
      ],
    });
    expect(batch.spans).toHaveLength(1);
    const outcome = otlpPartialSuccess('traces', batch);
    expect(outcome?.rejectedSpans).toBe(1);
    expect(outcome?.errorMessage).toMatch(/1 of 2 rejected: invalid_id/);
  });

  it('rejects data points over the limit instead of dropping them silently', () => {
    const dataPoints = Array.from({ length: 5003 }, () => ({ asDouble: 1, timeUnixNano: '0' }));
    const batch = metricsToBatch({
      resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'g', gauge: { dataPoints } }] }] }],
    });
    expect(batch.points).toHaveLength(5000);
    expect(otlpPartialSuccess('metrics', batch)).toMatchObject({ rejectedDataPoints: 3 });
  });

  it('counts summaries as unsupported rejections', () => {
    const batch = metricsToBatch({
      resourceMetrics: [
        { scopeMetrics: [{ metrics: [{ name: 's', summary: { dataPoints: [{}, {}] } }] }] },
      ],
    });
    expect(batch.rejected).toBe(2);
    expect(batch.rejectReason).toMatch(/unsupported_type/);
  });

  it('returns null when everything was accepted', () => {
    expect(otlpPartialSuccess('logs', metricsToBatch({}))).toBeNull();
  });
});

describe('OTLP protobuf histograms', () => {
  it('decodes bounds, packed bucket counts, temporality and start time', () => {
    const point = new Writer()
      .fixed64(2, 1_700_000_000_000_000_000n)
      .fixed64(3, 1_700_000_001_000_000_000n)
      .fixed64(4, 6n)
      .double(5, 42)
      .fixed64(6, 1n)
      .fixed64(6, 2n)
      .fixed64(6, 3n)
      .double(7, 10)
      .double(7, 100);
    const histogram = new Writer().message(1, point).uint(2, 2);
    const metric = new Writer().string(1, 'latency').string(3, 'ms').message(9, histogram);
    const req = new Writer().message(1, new Writer().message(2, new Writer().message(2, metric)));
    const p = metricsToBatch(decodeMetrics(req.finish())).points[0]!;
    expect(p.temporality).toBe('cumulative');
    expect(p.startTs?.getTime()).toBe(1_700_000_000_000);
    expect(p.histogram).toMatchObject({ bounds: [10, 100], counts: [1, 2, 3], sum: 42, count: 6 });
  });
});

describe('custom HTTP intake', () => {
  it('rejects invalid NDJSON lines by index and keeps the rest', () => {
    const batch = jsonLogsToBatch(
      '{"message":"a"}\nnot json\n{"message":"b","dt":"2026-11-14T10:00:00Z"}',
      'http',
    );
    expect(batch.logs).toHaveLength(2);
    expect(batch.rejections).toEqual([{ index: 1, code: 'invalid_json' }]);
  });

  it('accepts JSON metric points and rejects bad ones by index', () => {
    const batch = jsonMetricsToBatch(
      JSON.stringify([
        { name: 'queue.depth', value: 4, labels: { queue: 'mail' } },
        { name: 'broken', value: 'x' },
      ]),
    );
    expect(batch.points).toHaveLength(1);
    expect(batch.points[0]!.seriesKey).toHaveLength(32);
    expect(batch.rejections[0]?.index).toBe(1);
    expect(batch.rejections[0]?.code).toMatch(/invalid_point/);
  });

  it('parses Prometheus text exposition with types and labels', () => {
    const text = [
      '# TYPE http_requests_total counter',
      'http_requests_total{method="get",code="200",job="api"} 1027 1700000000000',
      '# TYPE temp gauge',
      'temp 21.5',
      'garbage line here !!',
    ].join('\n');
    const batch = prometheusTextToBatch(text, 1_700_000_000_000);
    expect(batch.points.map((p) => [p.name, p.kind, p.service])).toEqual([
      ['http_requests_total', 'counter', 'api'],
      ['temp', 'gauge', 'unknown-service'],
    ]);
    expect(batch.rejections).toEqual([{ index: 4, code: 'invalid_line' }]);
  });
});

describe('HTTP log fields', () => {
  it('keeps unused fallback keys such as status as attributes', () => {
    const log = recordToLog({ level: 'error', status: 500, message: 'timeout', route: '/pay' });
    expect(log.level).toBe('error');
    expect(log.attributes).toEqual({ status: 500, route: '/pay' });
  });

  it('still consumes status when it is the only level field', () => {
    const log = recordToLog({ status: 'warn', message: 'slow' });
    expect(log.level).toBe('warn');
    expect(log.attributes).toEqual({});
  });
});
