import type { INestApplication } from '@nestjs/common';
import type {
  DashboardView,
  IngestTokenWithSecret,
  MetricName,
  MetricSeries,
} from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Writer } from '../src/ingest/collector/domain/protobuf';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const kv = (key: string, value: string) =>
  new Writer().string(1, key).message(2, new Writer().string(1, value));
const nowNs = () => BigInt(Date.now()) * 1_000_000n;
const doubleBits = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeDoubleLE(n);
  return b.readBigUInt64LE();
};

describe('Metrics and dashboards (e2e)', () => {
  let app: INestApplication<App>;
  let owner: ReturnType<typeof request.agent>;
  let ws: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    owner = await loginAs(app, 'owner@metrics.test');
    ws = (await createWorkspace(owner, 'Metrics')).id;
    token = (
      (await owner.post(`/workspaces/${ws}/ingest/tokens`).send({ name: 'Default' }).expect(201))
        .body as IngestTokenWithSecret
    ).token;
  });
  afterAll(() => app.close());

  const send = () =>
    request(app.getHttpServer()).post('/v1/metrics').set('Authorization', `Bearer ${token}`);

  it('stores OTLP JSON gauges, counters and histograms and queries them as series', async () => {
    const ts = String(nowNs());
    await send()
      .send({
        resourceMetrics: [
          {
            resource: { attributes: [{ key: 'service.name', value: { stringValue: 'checkout' } }] },
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'cpu.usage',
                    unit: '%',
                    gauge: {
                      dataPoints: [
                        { timeUnixNano: ts, asDouble: 40 },
                        { timeUnixNano: ts, asInt: '60' },
                      ],
                    },
                  },
                  {
                    name: 'http.requests',
                    sum: {
                      isMonotonic: true,
                      dataPoints: [
                        { timeUnixNano: ts, asInt: '10' },
                        { timeUnixNano: ts, asInt: '70' },
                      ],
                    },
                  },
                  {
                    name: 'latency',
                    unit: 'ms',
                    histogram: { dataPoints: [{ timeUnixNano: ts, count: '4', sum: 200 }] },
                  },
                ],
              },
            ],
          },
          {
            resource: { attributes: [{ key: 'service.name', value: { stringValue: 'search' } }] },
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'cpu.usage',
                    gauge: { dataPoints: [{ timeUnixNano: ts, asDouble: 10 }] },
                  },
                ],
              },
            ],
          },
        ],
      })
      .expect(200);

    const names = (await owner.get(`/workspaces/${ws}/metrics/names`).expect(200))
      .body as MetricName[];
    expect(names.map((n) => n.name)).toEqual(['cpu.usage', 'http.requests', 'latency']);
    expect(names[0]).toMatchObject({
      kind: 'gauge',
      unit: '%',
      services: ['checkout', 'search'],
      points: 3,
    });
    expect(names[1]!.kind).toBe('counter');

    const get = async (query: Record<string, string>) =>
      (await owner.get(`/workspaces/${ws}/metrics/series`).query(query).expect(200))
        .body as MetricSeries;
    const last = (s: MetricSeries) => s.buckets.filter((b) => b.value !== null).at(-1)!.value;

    expect(last(await get({ name: 'cpu.usage', agg: 'max' }))).toBe(60);
    expect(last(await get({ name: 'cpu.usage', agg: 'avg', service: 'checkout' }))).toBe(50);
    expect(last(await get({ name: 'cpu.usage', agg: 'count' }))).toBe(3);
    expect(last(await get({ name: 'latency', agg: 'avg' }))).toBe(50);
    const rate = await get({ name: 'http.requests', agg: 'rate', minutes: '60' });
    expect(last(rate)).toBeCloseTo(60 / 60, 2);
    expect(rate.buckets).toHaveLength(60);
  });

  it('decodes OTLP protobuf gauges', async () => {
    const point = new Writer().fixed64(3, nowNs()).fixed64(4, doubleBits(7.5));
    const metric = new Writer().string(1, 'queue.depth').message(5, new Writer().message(1, point));
    const body = new Writer()
      .message(
        1,
        new Writer()
          .message(1, new Writer().message(1, kv('service.name', 'worker')))
          .message(2, new Writer().message(2, metric)),
      )
      .finish();
    await send().set('Content-Type', 'application/x-protobuf').send(Buffer.from(body)).expect(200);
    const series = (
      await owner
        .get(`/workspaces/${ws}/metrics/series`)
        .query({ name: 'queue.depth', agg: 'max' })
        .expect(200)
    ).body as MetricSeries;
    expect(
      series.buckets.at(-1)!.value ?? series.buckets.find((b) => b.value !== null)!.value,
    ).toBe(7.5);
  });

  it('keeps metrics per workspace and manages dashboards', async () => {
    const other = await loginAs(app, 'other@metrics.test');
    const otherWs = (await createWorkspace(other, 'Other')).id;
    expect(
      (await other.get(`/workspaces/${otherWs}/metrics/names`).expect(200)).body as MetricName[],
    ).toEqual([]);

    const created = (
      await owner
        .post(`/workspaces/${ws}/metrics/dashboards`)
        .send({
          name: 'Overview',
          widgets: [{ id: 'w1', title: 'CPU', metric: 'cpu.usage', agg: 'avg' }],
        })
        .expect(201)
    ).body as DashboardView;
    const updated = (
      await owner
        .patch(`/workspaces/${ws}/metrics/dashboards/${created.id}`)
        .send({ name: 'Main' })
        .expect(200)
    ).body as DashboardView;
    expect(updated).toMatchObject({ name: 'Main' });
    expect(updated.widgets).toHaveLength(1);
    await other
      .patch(`/workspaces/${otherWs}/metrics/dashboards/${created.id}`)
      .send({ name: 'x' })
      .expect(404);
    await owner.delete(`/workspaces/${ws}/metrics/dashboards/${created.id}`).expect(204);
    expect((await owner.get(`/workspaces/${ws}/metrics/dashboards`).expect(200)).body).toEqual([]);
  });
});
