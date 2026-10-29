import type { INestApplication } from '@nestjs/common';
import type {
  ApiError,
  Incident,
  Integration,
  IntegrationWithSecret,
  TimelineEntry,
} from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import { auditEvents, inboundEvents, incidentEvents, outbox, spans } from '../src/core/db/schema';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { extractError, type JaegerTrace } from '../src/ingest/ingestion/infrastructure/jaeger';
import { JaegerPoller } from '../src/ingest/ingestion/application/jaeger.poller';
import { sign } from '../src/ingest/ingestion/domain/webhook-signature';
import s1 from './fixtures/jaeger-trace-s1.json';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const trace = s1 as unknown as JaegerTrace;
type Agent = Awaited<ReturnType<typeof loginAs>>;

function signedDeploy(
  app: INestApplication<App>,
  url: string,
  secret: string,
  body: object,
  at = Date.now(),
) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(at / 1000));
  return request(app.getHttpServer())
    .post(new URL(url).pathname)
    .set('content-type', 'application/json')
    .set('x-ape-timestamp', ts)
    .set('x-ape-signature', sign(secret, ts, raw))
    .send(raw);
}

describe('Ingestion and incidents (e2e)', () => {
  let app: INestApplication<App>;
  let processor: IngestionProcessor;
  let poller: JaegerPoller;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  let owner: Agent;
  let ws: string;
  let webhook: IntegrationWithSecret;

  beforeAll(async () => {
    app = await createTestApp();
    processor = app.get(IngestionProcessor);
    poller = app.get(JaegerPoller);
  });
  beforeEach(async () => {
    await resetDatabase();
    owner = await loginAs(app, 'owner@ingest.test');
    ws = (await createWorkspace(owner, 'Ingest')).id;
    await owner
      .post(`/workspaces/${ws}/services`)
      .send({
        name: 'demo-shop-api',
        environment: 'production',
        repositoryFullName: 'me/demo-shop',
      })
      .expect(201);
    webhook = (
      await owner
        .post(`/workspaces/${ws}/integrations`)
        .send({ provider: 'deploy_webhook', name: 'Deploys' })
        .expect(201)
    ).body as IntegrationWithSecret;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function jaegerIntegration(): Promise<string> {
    jest.spyOn(poller.client, 'services').mockResolvedValue(['demo-shop-api']);
    const res = await owner
      .post(`/workspaces/${ws}/integrations`)
      .send({ provider: 'otel_jaeger', name: 'Jaeger' })
      .expect(201);
    const created = res.body as IntegrationWithSecret;
    expect(created.status).toBe('connected');
    return created.id;
  }

  async function queueErrors(integrationId: string, traceIds: string[]) {
    const base = extractError(trace, 'demo-shop-api')!;
    await db.insert(inboundEvents).values(
      traceIds.map((traceId, i) => ({
        workspaceId: ws,
        integrationId,
        source: 'otel_jaeger',
        externalEventId: traceId,
        payload: {
          ...base,
          traceId,
          occurredAt: new Date(Date.now() - (traceIds.length - i) * 1000).toISOString(),
        },
      })),
    );
  }

  const traceIds = (n: number, prefix = 'a') =>
    Array.from({ length: n }, (_, i) => `${prefix}${i.toString(16).padStart(31, '0')}`);

  it('shows the signing secret once and marks the webhook connected after a valid event', async () => {
    expect(webhook.signingSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(webhook.status).toBe('pending');
    const list = await owner.get(`/workspaces/${ws}/integrations`).expect(200);
    expect(JSON.stringify(list.body)).not.toContain(webhook.signingSecret!);

    const res = await signedDeploy(app, webhook.webhookUrl!, webhook.signingSecret!, {
      service: 'demo-shop-api',
      commit_sha: 'abc1234',
      env: 'production',
    }).expect(202);
    expect(res.body).toEqual({ accepted: true, duplicate: false });
    const after = await owner.get(`/workspaces/${ws}/integrations`).expect(200);
    expect((after.body as Integration[])[0]!.status).toBe('connected');
  });

  it('rejects and audits bad signatures, stale timestamps and unknown webhooks', async () => {
    const body = { service: 'demo-shop-api', commit_sha: 'abc1234', env: 'production' };
    await signedDeploy(app, webhook.webhookUrl!, 'whsec_wrong', body).expect(401);
    await signedDeploy(
      app,
      webhook.webhookUrl!,
      webhook.signingSecret!,
      body,
      Date.now() - 10 * 60_000,
    ).expect(401);
    await signedDeploy(
      app,
      webhook.webhookUrl!.replace(webhook.id, crypto.randomUUID()),
      webhook.signingSecret!,
      body,
    ).expect(404);

    const rejected = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.workspaceId, ws), eq(auditEvents.action, 'webhook.rejected')));
    expect(rejected.map((r) => r.metadata.reason).sort()).toEqual([
      'bad_signature',
      'stale_timestamp',
    ]);
    expect(rejected.every((r) => r.outcome === 'denied')).toBe(true);

    const list = await owner.get(`/workspaces/${ws}/integrations`).expect(200);
    expect((list.body as Integration[])[0]!.lastError).toContain('Rejected a webhook');
    expect(await db.select().from(inboundEvents)).toHaveLength(0);
  });

  it('treats a replayed identical webhook as a duplicate', async () => {
    const body = {
      service: 'demo-shop-api',
      commit_sha: 'abc1234',
      env: 'production',
      deployed_at: new Date().toISOString(),
    };
    await signedDeploy(app, webhook.webhookUrl!, webhook.signingSecret!, body).expect(202);
    const again = await signedDeploy(app, webhook.webhookUrl!, webhook.signingSecret!, body).expect(
      202,
    );
    expect((again.body as { duplicate: boolean }).duplicate).toBe(true);
  });

  it('stops accepting events after the webhook is disconnected', async () => {
    await owner.delete(`/workspaces/${ws}/integrations/${webhook.id}`).expect(204);
    await signedDeploy(app, webhook.webhookUrl!, webhook.signingSecret!, {
      service: 'demo-shop-api',
      commit_sha: 'abc1234',
      env: 'production',
    }).expect(404);
  });

  it('drops an error whose server span ended as a 4xx, and waits for a server span that is late', async () => {
    const integrationId = await jaegerIntegration();
    const base = extractError(trace, 'demo-shop-api')!;
    const [early, late] = traceIds(2, 'c');
    const serverSpan = (traceId: string, status: number) => ({
      workspaceId: ws,
      traceId,
      spanId: '00f067aa0ba902b7',
      service: 'demo-shop-api',
      environment: 'production',
      name: 'GET /api/Users',
      kind: 2,
      startTime: new Date(),
      durationMs: '2',
      attributes: { 'http.response.status_code': status },
    });
    await db.insert(spans).values(serverSpan(early!, 401));
    await db.insert(inboundEvents).values(
      [early!, late!].map((traceId) => ({
        workspaceId: ws,
        integrationId,
        source: 'otel_jaeger',
        externalEventId: traceId,
        payload: { ...base, traceId, httpStatus: null, occurredAt: new Date().toISOString() },
      })),
    );
    const open = async () =>
      ((await owner.get(`/workspaces/${ws}/incidents`).expect(200)).body as Incident[]).length;

    expect(await processor.processBatch()).toEqual({ processed: 1, retried: 1, dead: 0 });
    expect(await open()).toBe(0);

    await db.insert(spans).values(serverSpan(late!, 500));
    await db
      .update(inboundEvents)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(inboundEvents.externalEventId, late!));
    expect(await processor.processBatch()).toEqual({ processed: 1, retried: 0, dead: 0 });
    expect(await open()).toBe(1);
  });

  it('links incidents opened before their service was set up, once the service is created', async () => {
    const integrationId = await jaegerIntegration();
    const base = extractError(trace, 'demo-shop-api')!;
    await db.insert(inboundEvents).values({
      workspaceId: ws,
      integrationId,
      source: 'otel_jaeger',
      externalEventId: 'e'.padEnd(32, '0'),
      payload: {
        ...base,
        serviceName: 'orphan-api',
        traceId: 'e'.padEnd(32, '0'),
        occurredAt: new Date().toISOString(),
      },
    });
    await processor.processBatch();
    const list = async () =>
      (await owner.get(`/workspaces/${ws}/incidents`).expect(200)).body as Incident[];
    const [before] = await list();
    expect(before).toMatchObject({ serviceName: 'orphan-api', serviceId: null });

    await owner
      .post(`/workspaces/${ws}/services`)
      .send({
        name: 'orphan-api',
        environment: before!.environment,
        repositoryFullName: 'me/orphan-api',
      })
      .expect(201);
    expect((await list())[0]).toMatchObject({ repositoryFullName: 'me/orphan-api' });
  });

  it('keeps every non-error step on the timeline when errors pass the 200 cap', async () => {
    const incident = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Checkout fails', severity: 'high' })
        .expect(201)
    ).body as Incident;
    const start = Date.now();
    await db.insert(incidentEvents).values(
      Array.from({ length: 210 }, (_, i) => ({
        workspaceId: ws,
        incidentId: incident.id,
        kind: 'error',
        source: 'test',
        summary: 'boom',
        occurredAt: new Date(start + 1000 + i),
      })),
    );
    const timeline = (
      await owner.get(`/workspaces/${ws}/incidents/${incident.id}/timeline`).expect(200)
    ).body as TimelineEntry[];
    expect(timeline.filter((e) => e.kind === 'error')).toHaveLength(200);
    expect(timeline.some((e) => e.kind === 'created')).toBe(true);
  });

  it('turns 50 occurrences of one error into exactly one incident, with the deploy on its timeline', async () => {
    await signedDeploy(app, webhook.webhookUrl!, webhook.signingSecret!, {
      service: 'demo-shop-api',
      commit_sha: 'deadbee',
      version: '1.1.0',
      env: 'production',
      deployed_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    }).expect(202);
    const jaeger = await jaegerIntegration();
    await queueErrors(jaeger, traceIds(50));

    expect(await processor.processBatch(200)).toEqual({ processed: 51, retried: 0, dead: 0 });

    expect(await processor.processBatch(200)).toEqual({ processed: 0, retried: 0, dead: 0 });

    const list = await owner.get(`/workspaces/${ws}/incidents?status=open`).expect(200);
    const incidents = list.body as Incident[];
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      eventCount: 50,
      status: 'detected',
      severity: 'high',
      serviceName: 'demo-shop-api',
      environment: 'production',
      repositoryFullName: 'me/demo-shop',
    });
    const topics = (await db.select().from(outbox).where(eq(outbox.workspaceId, ws))).map(
      (r) => r.topic,
    );

    expect(topics.sort()).toEqual(['deploy.recorded', 'incident.detected']);

    const timeline = (
      await owner.get(`/workspaces/${ws}/incidents/${incidents[0]!.id}/timeline`).expect(200)
    ).body as TimelineEntry[];
    const deploy = timeline.find((e) => e.kind === 'deploy');
    expect(deploy).toMatchObject({ commitSha: 'deadbee', version: '1.1.0' });
    const firstError = timeline.find((e) => e.kind === 'error');
    expect(firstError?.kind === 'error' && firstError.sourceUrl).toContain('/trace/');
  });

  it('counts a trace once even when two integrations deliver it', async () => {
    const first = await jaegerIntegration();
    const second = (
      await owner
        .post(`/workspaces/${ws}/integrations`)
        .send({ provider: 'otel_jaeger', name: 'Jaeger 2' })
        .expect(201)
    ).body as { id: string };
    const ids = traceIds(5);
    await queueErrors(first, ids);
    await queueErrors(second.id, ids);
    await processor.processBatch(50);
    const [incident] = (await owner.get(`/workspaces/${ws}/incidents`).expect(200))
      .body as Incident[];
    expect(incident!.eventCount).toBe(5);
  });

  it('flags incidents from unmapped services instead of guessing a repository', async () => {
    const jaeger = await jaegerIntegration();
    const base = extractError(trace, 'demo-shop-api')!;
    await db.insert(inboundEvents).values({
      workspaceId: ws,
      integrationId: jaeger,
      source: 'otel_jaeger',
      externalEventId: 'f'.repeat(32),
      payload: { ...base, traceId: 'f'.repeat(32), serviceName: 'mystery-svc' },
    });
    await processor.processBatch();
    const [incident] = (await owner.get(`/workspaces/${ws}/incidents`).expect(200))
      .body as Incident[];
    expect(incident).toMatchObject({
      serviceId: null,
      repositoryFullName: null,
      serviceName: 'mystery-svc',
    });
  });

  it('dead-letters malformed events with a reason code and can replay them', async () => {
    const jaeger = await jaegerIntegration();
    const [row] = await db
      .insert(inboundEvents)
      .values({
        workspaceId: ws,
        integrationId: jaeger,
        source: 'otel_jaeger',
        externalEventId: 'broken',
        payload: { nope: true },
      })
      .returning();
    expect(await processor.processBatch()).toEqual({ processed: 0, retried: 0, dead: 1 });

    const dead = await owner.get(`/workspaces/${ws}/ingest/dead-letters`).expect(200);
    expect(dead.body).toEqual([
      expect.objectContaining({ id: row!.id, deadReason: 'invalid_payload' }),
    ]);
    await owner.post(`/workspaces/${ws}/ingest/dead-letters/${row!.id}/replay`).expect(204);
    const [replayed] = await db.select().from(inboundEvents).where(eq(inboundEvents.id, row!.id));
    expect(replayed!.status).toBe('pending');
  });

  it('enforces the lifecycle, versions and opens a new incident after closure', async () => {
    const jaeger = await jaegerIntegration();
    await queueErrors(jaeger, traceIds(2));
    await processor.processBatch();
    const [incident] = (await owner.get(`/workspaces/${ws}/incidents`).expect(200))
      .body as Incident[];
    const url = `/workspaces/${ws}/incidents/${incident!.id}/transitions`;

    const bad = await owner.post(url).send({ to: 'resolved', expectedVersion: 1 }).expect(409);
    expect((bad.body as ApiError).code).toBe('invalid_transition');
    await owner
      .post(url)
      .send({ to: 'investigating', expectedVersion: 1, reason: 'looking' })
      .expect(200);
    const stale = await owner
      .post(url)
      .send({ to: 'closed_without_fix', expectedVersion: 1 })
      .expect(409);
    expect((stale.body as ApiError).code).toBe('stale_version');
    await owner.post(url).send({ to: 'closed_without_fix', expectedVersion: 2 }).expect(200);

    const timeline = (await owner.get(`/workspaces/${ws}/incidents/${incident!.id}/timeline`))
      .body as TimelineEntry[];
    expect(timeline.filter((e) => e.kind === 'status_change')).toHaveLength(2);

    await queueErrors(jaeger, traceIds(1, 'b'));
    await processor.processBatch();
    const all = (await owner.get(`/workspaces/${ws}/incidents`).expect(200)).body as Incident[];
    expect(all.map((i) => i.status).sort()).toEqual(['closed_without_fix', 'detected']);
  });

  it('polls Jaeger for error traces of mapped services', async () => {
    const jaeger = await jaegerIntegration();
    const spy = jest.spyOn(poller.client, 'errorTraces').mockResolvedValue([trace, trace]);
    expect(await poller.pollAll()).toBe(1);
    expect(spy).toHaveBeenCalledWith('demo-shop-api', expect.any(Number), expect.any(Number));
    const rows = await db
      .select()
      .from(inboundEvents)
      .where(eq(inboundEvents.integrationId, jaeger));
    expect(rows.map((r) => r.externalEventId)).toEqual([trace.traceID]);
  });

  it('marks the Jaeger integration as errored with an actionable message when unreachable', async () => {
    jest.spyOn(poller.client, 'services').mockRejectedValue(new Error('fetch failed'));
    const res = await owner
      .post(`/workspaces/${ws}/integrations`)
      .send({ provider: 'otel_jaeger', name: 'Jaeger' })
      .expect(201);
    const created = res.body as Integration;
    expect(created.status).toBe('error');
    expect(created.lastError).toContain('make up');
  });

  it('lets engineers create incidents manually but not viewers', async () => {
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'v@ingest.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'v@ingest.test');
    await viewer
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Checkout is slow' })
      .expect(403);
    const res = await owner
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Checkout is slow', severity: 'low' })
      .expect(201);
    expect(res.body).toMatchObject({ source: 'manual', status: 'detected', severity: 'low' });
  });
});
