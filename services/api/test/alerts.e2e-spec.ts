/**
 * Phase 10: alert intake (token auth, durable buffer), routing, grouping into incidents,
 * dedup of repeats, resolution, heartbeats, previews and permissions.
 */
import type { INestApplication } from '@nestjs/common';
import type {
  AlertPreview,
  AlertRoute,
  AlertSourceWithToken,
  AlertView,
  Incident,
  Integration,
  TimelineEntry,
} from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AlertSourcesService } from '../src/alerts/alert-sources.service';
import { createDatabase } from '../src/db/client';
import { auditEvents, incidents } from '../src/db/schema';
import { IngestionProcessor } from '../src/ingestion/ingestion.processor';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const am = (alerts: { status: string; name: string; service: string; fp: string }[]) => ({
  alerts: alerts.map((a) => ({
    status: a.status,
    labels: { alertname: a.name, service: a.service, env: 'production', severity: 'critical' },
    annotations: { summary: `${a.name} on ${a.service}` },
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: a.status === 'resolved' ? new Date().toISOString() : '0001-01-01T00:00:00Z',
    fingerprint: a.fp,
  })),
});

describe('Alerts, routes and heartbeats (e2e)', () => {
  let app: INestApplication<App>;
  let processor: IngestionProcessor;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    processor = app.get(IngestionProcessor);
  });
  beforeEach(() => resetDatabase());
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function setup() {
    const owner = await loginAs(app, 'owner@alerts.test');
    const ws = (await createWorkspace(owner, 'Alerts')).id;
    const source = (
      await owner
        .post(`/workspaces/${ws}/alert-sources`)
        .send({ kind: 'alertmanager', name: 'Prometheus' })
        .expect(201)
    ).body as AlertSourceWithToken;
    const send = (body: unknown, token = source.token) =>
      request(app.getHttpServer())
        .post(`/ingest/alerts/${source.id}`)
        .set('authorization', `Bearer ${token}`)
        .send(body as object);
    return { owner, ws, source, send };
  }

  const list = async (agent: Awaited<ReturnType<typeof loginAs>>, ws: string, q = '') =>
    (await agent.get(`/workspaces/${ws}/alerts${q}`).expect(200)).body as AlertView[];

  it('authenticates intake by token, buffers durably and dedups retried bodies', async () => {
    const { owner, ws, source, send } = await setup();
    expect(source.token).toMatch(/^ape_alert_[0-9a-f]{48}$/);
    expect(source.url).toBe(`http://localhost:4000/ingest/alerts/${source.id}`);

    await send(am([{ status: 'firing', name: 'X', service: 's', fp: '1' }]), 'wrong').expect(401);
    await request(app.getHttpServer()).post(`/ingest/alerts/${source.id}`).send({}).expect(401);
    await request(app.getHttpServer())
      .post('/ingest/alerts/not-a-uuid')
      .set('x-ape-token', 'x')
      .send({})
      .expect(401);
    const denied = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'alert_source.rejected'));
    expect(denied.length).toBeGreaterThanOrEqual(3);

    const body = am([{ status: 'firing', name: 'HighErrorRate', service: 'checkout', fp: 'fp1' }]);
    expect((await send(body).expect(202)).body).toEqual({ accepted: true, duplicate: false });
    expect((await send(body).expect(202)).body).toEqual({ accepted: true, duplicate: true });
    // Token in the query string works for tools that cannot set headers.
    await request(app.getHttpServer())
      .post(`/ingest/alerts/${source.id}?token=${source.token}`)
      .send(am([{ status: 'firing', name: 'Other', service: 'x', fp: 'fp2' }]))
      .expect(202);

    expect(await processor.processBatch()).toMatchObject({ processed: 2, dead: 0 });
    const alerts = await list(owner, ws);
    expect(alerts).toHaveLength(2);
    // No route yet: alerts are kept, but nothing is opened.
    expect(alerts.every((a) => a.routeId === null && a.incidentId === null)).toBe(true);
    // Alert sources live on their own page, not in Integrations.
    expect(
      ((await owner.get(`/workspaces/${ws}/integrations`).expect(200)).body as Integration[])
        .length,
    ).toBe(0);
  });

  it('routes and groups alerts into incidents, dedups repeats and records resolution', async () => {
    const { owner, ws, source, send } = await setup();
    await owner
      .post(`/workspaces/${ws}/alert-routes`)
      .send({
        name: 'Staging only',
        conditions: [{ field: 'label.env', op: 'eq', value: 'staging' }],
      })
      .expect(201);
    const prod = (
      await owner
        .post(`/workspaces/${ws}/alert-routes`)
        .send({
          name: 'Production by service',
          sourceIds: [source.id],
          conditions: [{ field: 'label.env', op: 'eq', value: 'production' }],
          groupBy: ['service'],
        })
        .expect(201)
    ).body as AlertRoute;

    await send(
      am([
        { status: 'firing', name: 'HighErrorRate', service: 'checkout', fp: 'a' },
        { status: 'firing', name: 'HighLatency', service: 'checkout', fp: 'b' },
        { status: 'firing', name: 'HighErrorRate', service: 'search', fp: 'c' },
      ]),
    ).expect(202);
    await processor.processBatch();

    const open = (await owner.get(`/workspaces/${ws}/incidents?status=open`).expect(200))
      .body as Incident[];
    expect(open).toHaveLength(2); // checkout (2 alerts) and search (1 alert)
    const checkout = open.find((i) => i.title.includes('checkout'))!;
    expect(checkout).toMatchObject({
      severity: 'critical',
      serviceName: 'checkout',
      environment: 'production',
      eventCount: 2,
      source: 'alert:alertmanager',
    });
    const grouped = await list(owner, ws, `?incidentId=${checkout.id}`);
    expect(grouped.map((a) => a.title).sort()).toEqual([
      'HighErrorRate on checkout',
      'HighLatency on checkout',
    ]);
    expect(grouped[0]).toMatchObject({
      routeId: prod.id,
      routeName: 'Production by service',
      sourceKind: 'alertmanager',
    });

    // A repeat notification counts but adds no timeline noise.
    await send({
      ...am([{ status: 'firing', name: 'HighErrorRate', service: 'checkout', fp: 'a' }]),
      receiver: 'again',
    }).expect(202);
    await processor.processBatch();
    expect(
      (await list(owner, ws, `?incidentId=${checkout.id}`)).find((a) =>
        a.title.startsWith('HighErrorRate'),
      )!.occurrences,
    ).toBe(2);

    await send(
      am([
        { status: 'resolved', name: 'HighErrorRate', service: 'checkout', fp: 'a' },
        { status: 'resolved', name: 'HighLatency', service: 'checkout', fp: 'b' },
      ]),
    ).expect(202);
    await processor.processBatch();
    const timeline = (
      await owner.get(`/workspaces/${ws}/incidents/${checkout.id}/timeline`).expect(200)
    ).body as TimelineEntry[];
    const alertEvents = timeline.filter((e) => e.kind === 'alert').map((e) => e.summary);
    expect(alertEvents.filter((s) => s?.startsWith('Alert fired'))).toHaveLength(2);
    expect(alertEvents.filter((s) => s?.startsWith('Alert resolved'))).toHaveLength(2);
    expect(alertEvents).toContain('All alerts for this incident have resolved');
    const fired = timeline.find(
      (e): e is Exclude<TimelineEntry, { kind: 'deploy' }> =>
        e.kind === 'alert' && !!e.summary?.startsWith('Alert fired'),
    );
    expect(fired!.attributes.reason).toBe(
      'Grouped by route "Production by service" on service=checkout',
    );
    // Resolving alerts does not close the incident: a human (or verification) decides.
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, checkout.id));
    expect(inc!.status).not.toBe('resolved');
    expect(await list(owner, ws, '?status=firing')).toHaveLength(1);
  });

  it('previews a payload against the routes without storing anything', async () => {
    const { owner, ws, source } = await setup();
    await owner
      .post(`/workspaces/${ws}/alert-routes`)
      .send({ name: 'All', groupBy: ['service'] })
      .expect(201);
    const preview = (
      await owner
        .post(`/workspaces/${ws}/alert-routes/preview`)
        .send({
          sourceId: source.id,
          payload: am([{ status: 'firing', name: 'Disk', service: 'db', fp: 'z' }]),
        })
        .expect(200)
    ).body as AlertPreview;
    expect(preview.alerts[0]).toMatchObject({
      title: 'Disk on db',
      route: { name: 'All' },
      groupKey: 'service=db',
      createsIncident: true,
    });
    const bad = (
      await owner
        .post(`/workspaces/${ws}/alert-routes/preview`)
        .send({ sourceId: source.id, payload: { nope: 1 } })
        .expect(200)
    ).body as AlertPreview;
    expect(bad.error).toContain('alerts');
    expect(await list(owner, ws)).toHaveLength(0);
  });

  it('raises and resolves an alert for a missed heartbeat', async () => {
    const { owner, ws } = await setup();
    await owner.post(`/workspaces/${ws}/alert-routes`).send({ name: 'Everything' }).expect(201);
    const hb = (
      await owner
        .post(`/workspaces/${ws}/alert-sources`)
        .send({ kind: 'heartbeat', name: 'nightly-backup', intervalSeconds: 60, graceSeconds: 0 })
        .expect(201)
    ).body as AlertSourceWithToken;
    expect(hb.url).toContain(`/ingest/heartbeats/${hb.id}`);
    const sources = app.get(AlertSourcesService);

    // Pings keep it up; heartbeats reject alert payloads and alert sources reject pings.
    await request(app.getHttpServer())
      .get(`/ingest/heartbeats/${hb.id}?token=${hb.token}`)
      .expect(202);
    await request(app.getHttpServer())
      .post(`/ingest/alerts/${hb.id}`)
      .set('x-ape-token', hb.token)
      .send({})
      .expect(400);
    expect(await sources.checkHeartbeats(new Date(Date.now() + 30_000))).toBe(0);

    expect(await sources.checkHeartbeats(new Date(Date.now() + 120_000))).toBe(1);
    expect(await sources.checkHeartbeats(new Date(Date.now() + 180_000))).toBe(0); // already down
    await processor.processBatch();
    let [a] = await list(owner, ws);
    expect(a).toMatchObject({
      title: 'Heartbeat "nightly-backup" missed',
      status: 'firing',
      severity: 'high',
    });
    expect(a!.incidentId).not.toBeNull();

    const ping = await request(app.getHttpServer())
      .post(`/ingest/heartbeats/${hb.id}`)
      .set('authorization', `Bearer ${hb.token}`)
      .expect(202);
    expect(ping.body).toEqual({ accepted: true, state: 'recovered' });
    await processor.processBatch();
    [a] = await list(owner, ws);
    expect(a!.status).toBe('resolved');
  });

  it('applies route order, rotates tokens and enforces permissions', async () => {
    const { owner, ws, source, send } = await setup();
    const first = (
      await owner
        .post(`/workspaces/${ws}/alert-routes`)
        .send({ name: 'First', createIncident: false })
        .expect(201)
    ).body as AlertRoute;
    const second = (
      await owner.post(`/workspaces/${ws}/alert-routes`).send({ name: 'Second' }).expect(201)
    ).body as AlertRoute;
    await owner
      .put(`/workspaces/${ws}/alert-routes/order`)
      .send({ ids: [second.id, first.id] })
      .expect(200);
    await send(am([{ status: 'firing', name: 'A', service: 's', fp: '1' }])).expect(202);
    await processor.processBatch();
    expect((await list(owner, ws))[0]).toMatchObject({ routeName: 'Second' });

    const rotated = (
      await owner.post(`/workspaces/${ws}/alert-sources/${source.id}/rotate-token`).expect(200)
    ).body as AlertSourceWithToken;
    await send(am([{ status: 'firing', name: 'B', service: 's', fp: '2' }])).expect(401);
    await send(am([{ status: 'firing', name: 'B', service: 's', fp: '2' }]), rotated.token).expect(
      202,
    );

    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@alerts.test', role: 'engineer' })
      .expect(201);
    const eng = await loginAs(app, 'eng@alerts.test');
    await eng.get(`/workspaces/${ws}/alerts`).expect(200);
    await eng.post(`/workspaces/${ws}/alert-routes`).send({ name: 'Nope' }).expect(403);
    await eng
      .post(`/workspaces/${ws}/alert-sources`)
      .send({ kind: 'http', name: 'Nope' })
      .expect(403);
    await owner
      .post(`/workspaces/${ws}/alert-routes`)
      .send({ name: 'Bad regex', conditions: [{ field: 'title', op: 'regex', value: '(' }] })
      .expect(400);

    // A route cannot point at another workspace's source.
    const other = (await createWorkspace(owner, 'Other ws')).id;
    await owner
      .post(`/workspaces/${other}/alert-routes`)
      .send({ name: 'Steal', sourceIds: [source.id] })
      .expect(404);

    await owner.delete(`/workspaces/${ws}/alert-sources/${source.id}`).expect(204);
    await send(am([{ status: 'firing', name: 'C', service: 's', fp: '3' }]), rotated.token).expect(
      401,
    );
    const [stillThere] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.workspaceId, ws)));
    expect(stillThere).toBeDefined();
  });
});
