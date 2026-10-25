import { gzipSync } from 'node:zlib';
import type {
  DiscoveredService,
  IngestOverview,
  IngestTokenWithSecret,
  LogSearchResult,
  ToolView,
} from '@ape/api-contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Writer } from '../src/collector/protobuf';
import { IngestionProcessor } from '../src/ingestion/ingestion.processor';
import { ToolsService } from '../src/tools/tools.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const kv = (key: string, value: string) =>
  new Writer().string(1, key).message(2, new Writer().string(1, value));

describe('Telemetry intake, ingest tokens and tools (e2e)', () => {
  let app: INestApplication<App>;
  let owner: ReturnType<typeof request.agent>;
  let ws: { id: string };
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    owner = await loginAs(app, 'owner@shop.test');
    ws = await createWorkspace(owner, 'Shop');
    token = (
      (await owner.post(`/workspaces/${ws.id}/ingest/tokens`).send({ name: 'Default' }).expect(201))
        .body as IngestTokenWithSecret
    ).token;
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const logs = async (q = '') =>
    (
      await owner
        .get(`/workspaces/${ws.id}/logs`)
        .query({ q, from: new Date(Date.now() - 3600_000).toISOString() })
        .expect(200)
    ).body as LogSearchResult;

  it('shows the token once, masks it afterwards, and needs admin to create', async () => {
    const overview = (await owner.get(`/workspaces/${ws.id}/ingest`).expect(200))
      .body as IngestOverview;
    expect(overview.tokens[0]!.masked).toMatch(/^ape_live_•+/);
    expect(JSON.stringify(overview)).not.toContain(token);
    expect(overview.ways.every((w) => w.state === 'not_set_up')).toBe(true);

    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'v@shop.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'v@shop.test');
    await viewer.get(`/workspaces/${ws.id}/ingest`).expect(200);
    await viewer.post(`/workspaces/${ws.id}/ingest/tokens`).send({ name: 'x' }).expect(403);
  });

  it('rejects missing, unknown and revoked tokens', async () => {
    await http().post('/v1/logs').send({ message: 'x' }).expect(401);
    await http()
      .post('/v1/logs')
      .set('Authorization', 'Bearer ape_live_nope')
      .send({ message: 'x' })
      .expect(401);
    const overview = (await owner.get(`/workspaces/${ws.id}/ingest`).expect(200))
      .body as IngestOverview;
    await owner.delete(`/workspaces/${ws.id}/ingest/tokens/${overview.tokens[0]!.id}`).expect(204);
    await http()
      .post('/v1/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'x' })
      .expect(401);
  });

  it('Way 3: HTTP API JSON, NDJSON and gzip; redacts secrets; searchable', async () => {
    await http()
      .post('/v1/logs')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          message: 'Checkout failed for jane@example.com password=hunter22',
          level: 'error',
          service: 'checkout-api',
        }),
      )
      .expect(202);
    await http()
      .post('/v1/logs?token=' + token)
      .set('Content-Type', 'application/x-ndjson')
      .set('Content-Encoding', 'gzip')
      .send(
        gzipSync(
          '{"msg":"a","level":"info","service":"orders"}\n{"msg":"b","level":"warn","service":"orders"}\n',
        ),
      )
      .expect(202);

    const all = await logs();
    expect(all.lines).toHaveLength(3);
    expect(all.lines.find((l) => l.service === 'checkout-api')!.message).toBe(
      'Checkout failed for [REDACTED:email] password=[REDACTED:secret]',
    );
    expect((await logs('level:warn service:orders')).lines.map((l) => l.message)).toEqual(['b']);
    expect((await logs('"checkout failed"')).lines).toHaveLength(1);
    expect(all.histogram.reduce((n, b) => n + b.total, 0)).toBe(3);

    const overview = (await owner.get(`/workspaces/${ws.id}/ingest`).expect(200))
      .body as IngestOverview;
    expect(overview.ways.find((w) => w.way === 'http')!.state).toBe('receiving');
  });

  it('lists telemetry services that have no mapping yet', async () => {
    for (const service of ['checkout-api', 'orders']) {
      await http()
        .post('/v1/logs')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'x', service })
        .expect(202);
    }
    const discovered = async () =>
      (await owner.get(`/workspaces/${ws.id}/services/discovered`).expect(200))
        .body as DiscoveredService[];

    const found = await discovered();
    expect(found.map((f) => f.name).sort()).toEqual(['checkout-api', 'orders']);
    const { environment } = found.find((f) => f.name === 'checkout-api')!;
    await owner
      .post(`/workspaces/${ws.id}/services`)
      .send({ name: 'checkout-api', environment })
      .expect(201);
    expect((await discovered()).map((f) => f.name)).toEqual(['orders']);
  });

  it('Way 2: OTLP protobuf traces open an incident through the ingestion pipeline', async () => {
    const event = new Writer()
      .fixed64(1, BigInt(Date.now()) * 1_000_000n)
      .string(2, 'exception')
      .message(3, kv('exception.type', 'TypeError'))
      .message(3, kv('exception.message', 'Cannot read properties of null'))
      .message(3, kv('exception.stacktrace', 'TypeError: x\n    at price (src/pricing.ts:81:46)'));
    const span = new Writer()
      .bytes(1, Buffer.from('4bf92f3577b34da6a3ce929d0e0e4736', 'hex'))
      .bytes(2, Buffer.from('00f067aa0ba902b7', 'hex'))
      .string(5, 'POST /checkout')
      .fixed64(7, BigInt(Date.now()) * 1_000_000n)
      .fixed64(8, BigInt(Date.now() + 20) * 1_000_000n)
      .message(9, kv('http.route', '/checkout'))
      .message(11, event)
      .message(15, new Writer().uint(3, 2));
    const body = new Writer()
      .message(
        1,
        new Writer()
          .message(1, new Writer().message(1, kv('service.name', 'checkout-api')))
          .message(2, new Writer().message(2, span)),
      )
      .finish();

    const res = await http()
      .post('/v1/traces')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/x-protobuf')
      .send(Buffer.from(body))
      .expect(200);
    expect(res.headers['content-type']).toContain('application/x-protobuf');

    await app.get(IngestionProcessor).processBatch();
    const incidents = (await owner.get(`/workspaces/${ws.id}/incidents`).expect(200)).body as {
      title: string;
      source: string;
    }[];
    expect(incidents).toHaveLength(1);
    expect(incidents[0]!.title).toBe('TypeError: Cannot read properties of null (/checkout)');
    expect(incidents[0]!.source).toBe('ingest_error');

    const trace = (
      await owner.get(`/workspaces/${ws.id}/traces/4bf92f3577b34da6a3ce929d0e0e4736`).expect(200)
    ).body as unknown[];
    expect(trace).toHaveLength(1);
  });

  it('Way 1: SDK errors dedupe by event id', async () => {
    const err = {
      event_id: 'abc-1',
      type: 'RangeError',
      message: 'bad qty',
      service: 'shop',
      stack: 'RangeError: bad qty\n    at cart (cart.js:3:9)',
    };
    for (let i = 0; i < 2; i++)
      await http()
        .post('/v1/errors')
        .set('Authorization', `Bearer ${token}`)
        .set('x-ape-sdk', 'node/0.1.0')
        .send(err)
        .expect(202);
    await app.get(IngestionProcessor).processBatch();
    const incidents = (await owner.get(`/workspaces/${ws.id}/incidents`).expect(200)).body as {
      eventCount: number;
    }[];
    expect(incidents).toHaveLength(1);
    expect(incidents[0]!.eventCount).toBe(1);
    const overview = (await owner.get(`/workspaces/${ws.id}/ingest`).expect(200))
      .body as IngestOverview;
    expect(overview.ways.find((w) => w.way === 'package')!.state).toBe('receiving');
  });

  it('Way 5: Vercel and Heroku drains, idempotent on retry', async () => {
    const vercel = [
      {
        id: 'v1',
        deploymentId: 'd',
        source: 'lambda',
        host: 'h',
        timestamp: Date.now(),
        projectId: 'p',
        projectName: 'web',
        level: 'info',
        message: 'hello',
      },
    ];
    for (let i = 0; i < 2; i++)
      await http().post(`/v1/drain?token=${token}`).send(vercel).expect(200);
    const line = `<190>1 ${new Date().toISOString()} host app web.1 - State changed from up to down`;
    for (let i = 0; i < 2; i++)
      await http()
        .post('/v1/drain?service=heroku-app')
        .auth('x', token)
        .set('Content-Type', 'application/logplex-1')
        .set('Logplex-Frame-Id', 'frame-9')
        .send(`${Buffer.byteLength(line) + 1} ${line}\n`)
        .expect(204);
    const all = await logs();
    expect(all.lines.map((l) => `${l.service}:${l.message}`).sort()).toEqual([
      'heroku-app:State changed from up to down',
      'web:hello',
    ]);
  });

  it('Ways 6 and 7: tool alerts and read-only connection with a test query', async () => {
    const tools = app.get(ToolsService);
    const on = await owner
      .put(`/workspaces/${ws.id}/tools/sentry/alerts`)
      .send({ enabled: true })
      .expect(200);
    const enabled = on.body as { token: string; setup: string; url: string };
    expect(enabled.token).toMatch(/^ape_alert_/);
    expect(enabled.setup).toContain(enabled.url);

    tools.fetchFn = () => Promise.resolve(new Response(JSON.stringify({ data: { result: [] } })));
    const ok = (
      await owner
        .put(`/workspaces/${ws.id}/tools/grafana/reader`)
        .send({ url: 'https://loki.example', token: 'secret-token' })
        .expect(200)
    ).body as ToolView;
    expect(ok.reader.status).toBe('connected');
    expect(JSON.stringify(ok)).not.toContain('secret-token');

    tools.fetchFn = () => Promise.resolve(new Response('nope', { status: 401 }));
    const bad = (
      await owner
        .put(`/workspaces/${ws.id}/tools/datadog/reader`)
        .send({ apiKey: 'a', appKey: 'b' })
        .expect(200)
    ).body as ToolView;
    expect(bad.reader).toMatchObject({ status: 'error' });
    expect(bad.reader.lastError).toMatch(/rejected the credentials/);

    const list = (await owner.get(`/workspaces/${ws.id}/tools`).expect(200)).body as ToolView[];
    expect(list.find((t) => t.id === 'sentry')!.alerts.enabled).toBe(true);
    await owner
      .put(`/workspaces/${ws.id}/tools/sentry/alerts`)
      .send({ enabled: false })
      .expect(200);
    await owner.delete(`/workspaces/${ws.id}/tools/grafana/reader`).expect(200);
    const after = (await owner.get(`/workspaces/${ws.id}/tools`).expect(200)).body as ToolView[];
    expect(after.find((t) => t.id === 'sentry')!.alerts.enabled).toBe(false);
    expect(after.find((t) => t.id === 'grafana')!.reader.status).toBe('not_connected');
  });
});
