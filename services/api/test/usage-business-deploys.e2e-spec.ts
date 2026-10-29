import type { INestApplication } from '@nestjs/common';
import type {
  ApiError,
  BusinessImpact,
  Deployment,
  DeploymentDetail,
  Incident,
  IntegrationWithSecret,
  Service,
  TimelineEntry,
  UsageSummary,
} from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import {
  auditEvents,
  incidentEvents,
  incidents,
  investigations,
  spans,
  usageRecords,
} from '../src/core/db/schema';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { sign } from '../src/ingest/ingestion/domain/webhook-signature';
import { InvestigationActivities } from '../src/modules/investigations/activities/investigation-activities.service';
import { TemporalService } from '../src/core/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

type Agent = Awaited<ReturnType<typeof loginAs>>;

describe('Deploys, business impact, usage and limits (e2e)', () => {
  let app: INestApplication<App>;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  let owner: Agent;
  let ws: string;
  let service: Service;

  async function member(email: string, role: 'admin' | 'engineer' | 'viewer') {
    await owner.post(`/workspaces/${ws}/invitations`).send({ email, role }).expect(201);
    return loginAs(app, email);
  }

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    owner = await loginAs(app, 'owner@usage.test');
    ws = (await createWorkspace(owner, 'Usage')).id;
    service = (
      await owner
        .post(`/workspaces/${ws}/services`)
        .send({ name: 'shop-api', environment: 'production' })
        .expect(201)
    ).body as Service;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  it('lists deploy markers newest first, filtered by service and environment', async () => {
    const hook = (
      await owner
        .post(`/workspaces/${ws}/integrations`)
        .send({ provider: 'deploy_webhook', name: 'CI deploys' })
        .expect(201)
    ).body as IntegrationWithSecret;
    const send = (body: object) => {
      const raw = JSON.stringify(body);
      const ts = String(Math.floor(Date.now() / 1000));
      return request(app.getHttpServer())
        .post(new URL(hook.webhookUrl!).pathname)
        .set('content-type', 'application/json')
        .set('x-ape-timestamp', ts)
        .set('x-ape-signature', sign(hook.signingSecret!, ts, raw))
        .send(raw)
        .expect(202);
    };
    const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
    await send({
      service: 'shop-api',
      commit_sha: 'aaa1111',
      env: 'production',
      deployed_at: at(30),
    });
    await send({
      service: 'shop-api',
      commit_sha: 'bbb2222',
      env: 'production',
      version: '1.2.0',
      deployed_at: at(5),
    });
    await send({ service: 'shop-web', commit_sha: 'ccc3333', env: 'staging', deployed_at: at(10) });
    await app.get(IngestionProcessor).processBatch();

    const all = (await owner.get(`/workspaces/${ws}/deployments`).expect(200)).body as Deployment[];
    expect(all.map((d) => d.commitSha)).toEqual(['bbb2222', 'ccc3333', 'aaa1111']);
    expect(all[0]).toMatchObject({
      serviceId: service.id,
      serviceName: 'shop-api',
      version: '1.2.0',
      integrationName: 'CI deploys',
    });
    expect(all[1]!.serviceId).toBeNull();

    const viewer = await member('viewer@usage.test', 'viewer');
    const shop = (
      await viewer
        .get(`/workspaces/${ws}/deployments?service=shop-api&environment=production`)
        .expect(200)
    ).body as Deployment[];
    expect(shop.map((d) => d.commitSha)).toEqual(['bbb2222', 'aaa1111']);
    await owner.get(`/workspaces/${ws}/deployments?limit=0`).expect(400);

    const incident = (minAgo: number, title: string, service = 'shop-api') => ({
      workspaceId: ws,
      title,
      serviceName: service,
      environment: 'production',
      fingerprint: title,
      firstSeenAt: new Date(Date.now() - minAgo * 60_000),
      lastSeenAt: new Date(),
    });
    await db
      .insert(incidents)
      .values([
        incident(40, 'before the deploy'),
        incident(20, 'after the first deploy'),
        incident(2, 'after the second deploy'),
        incident(20, 'other service', 'shop-web'),
      ]);
    const first = (await viewer.get(`/workspaces/${ws}/deployments/${all[2]!.id}`).expect(200))
      .body as DeploymentDetail;
    expect(first.previous).toBeNull();
    expect(first.next?.commitSha).toBe('bbb2222');
    expect(first.incidents.map((i) => i.title)).toEqual(['after the first deploy']);
    const latest = (await viewer.get(`/workspaces/${ws}/deployments/${all[0]!.id}`).expect(200))
      .body as DeploymentDetail;
    expect(latest.previous?.commitSha).toBe('aaa1111');
    expect(latest.next).toBeNull();
    expect(latest.incidents.map((i) => i.title)).toEqual(['after the second deploy']);

    const other = await loginAs(app, 'other@usage.test');
    await other.get(`/workspaces/${ws}/deployments`).expect(404);
    const otherWs = (await createWorkspace(other, 'Other')).id;
    await other.get(`/workspaces/${otherWs}/deployments/${all[0]!.id}`).expect(404);
  });

  it('shows no money until an admin sets a value, then failed traces × value', async () => {
    const incident = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Checkout fails', serviceId: service.id })
        .expect(201)
    ).body as Incident;
    const now = Date.now();
    const span = (traceId: string, statusCode: number, minAgo = 1) => ({
      workspaceId: ws,
      traceId,
      spanId: `${traceId}-s`,
      service: 'shop-api',
      environment: 'production',
      name: 'POST /checkout',
      startTime: new Date(now - minAgo * 60_000),
      durationMs: '12',
      statusCode,
    });
    await db
      .insert(spans)
      .values([span('t1', 2), span('t2', 2), span('t3', 1), span('t4', 2, 60 * 24 * 10)]);
    await db.insert(incidentEvents).values([
      {
        workspaceId: ws,
        incidentId: incident.id,
        kind: 'error',
        source: 'test',
        traceId: 't1',
        occurredAt: new Date(now),
      },
      {
        workspaceId: ws,
        incidentId: incident.id,
        kind: 'error',
        source: 'test',
        traceId: 't9',
        occurredAt: new Date(now),
      },
    ]);

    const before = (await owner.get(`/workspaces/${ws}/business/impact`).expect(200))
      .body as BusinessImpact;
    expect(before.days).toBe(7);
    expect(before.services[0]).toMatchObject({
      serviceId: service.id,
      failedRequests: 3,
      errorSpanTraces: 2,
      incidentErrorEvents: 2,
      incidents: 1,
      valuePerRequest: null,
      impact: null,
    });

    const engineer = await member('eng@usage.test', 'engineer');
    const url = `/workspaces/${ws}/business/services/${service.id}/value`;
    await engineer.put(url).send({ valuePerRequest: 2.5, currency: 'INR' }).expect(403);
    await owner.put(url).send({ valuePerRequest: -1 }).expect(400);
    await owner.put(url).send({ valuePerRequest: 2.5, currency: 'inr' }).expect(204);

    const after = (await engineer.get(`/workspaces/${ws}/business/impact?days=30`).expect(200))
      .body as BusinessImpact;
    expect(after.services[0]).toMatchObject({
      failedRequests: 4,
      valuePerRequest: 2.5,
      currency: 'INR',
      impact: 10,
    });
    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.workspaceId, ws), eq(auditEvents.action, 'service.value_set')));
    expect(audit?.outcome).toBe('success');

    await owner.put(url).send({ valuePerRequest: null }).expect(204);
    const cleared = (await owner.get(`/workspaces/${ws}/business/impact`).expect(200))
      .body as BusinessImpact;
    expect(cleared.services[0]).toMatchObject({
      valuePerRequest: null,
      currency: null,
      impact: null,
    });
  });

  it('summarises usage by month and lets only the owner set limits', async () => {
    await db.insert(usageRecords).values([
      { workspaceId: ws, metric: 'investigations', quantity: '1' },
      { workspaceId: ws, metric: 'model_input_tokens', quantity: '1200' },
      { workspaceId: ws, metric: 'model_output_tokens', quantity: '300' },
      { workspaceId: ws, metric: 'model_cost_usd', quantity: '0.0125' },
      { workspaceId: ws, metric: 'sandbox_seconds', quantity: '90' },
    ]);
    const summary = (await owner.get(`/workspaces/${ws}/usage`).expect(200)).body as UsageSummary;
    expect(summary.months).toHaveLength(6);
    expect(summary.months[0]).toMatchObject({
      month: new Date().toISOString().slice(0, 7),
      investigations: 1,
      inputTokens: 1200,
      outputTokens: 300,
      aiCostUsd: 0.0125,
      sandboxMinutes: 1.5,
    });
    expect(summary.months[1]!.investigations).toBe(0);
    expect(summary.limits).toEqual({ monthlyAiBudgetUsd: null, maxConcurrentInvestigations: null });
    expect(summary.blockedReason).toBeNull();

    const admin = await member('admin@usage.test', 'admin');
    await admin.get(`/workspaces/${ws}/usage`).expect(200);
    const limits = { monthlyAiBudgetUsd: 25, maxConcurrentInvestigations: 2 };
    await admin.put(`/workspaces/${ws}/usage/limits`).send(limits).expect(403);
    await owner
      .put(`/workspaces/${ws}/usage/limits`)
      .send({ ...limits, maxConcurrentInvestigations: 0 })
      .expect(400);
    const saved = (await owner.put(`/workspaces/${ws}/usage/limits`).send(limits).expect(200))
      .body as UsageSummary;
    expect(saved.limits).toEqual(limits);
    const viewer = await member('viewer@usage.test', 'viewer');
    await viewer.get(`/workspaces/${ws}/usage`).expect(403);
  });

  it('blocks manual and automatic investigation starts over the limits, on the timeline and in audit', async () => {
    const incident = (
      await owner
        .post(`/workspaces/${ws}/incidents`)
        .send({ title: 'Checkout fails', serviceId: service.id })
        .expect(201)
    ).body as Incident;
    const temporal = app.get(TemporalService);
    jest.spyOn(temporal, 'state').mockResolvedValue(null);
    const requested = jest.spyOn(temporal, 'requestInvestigation').mockResolvedValue(undefined);
    const acts = app.get(InvestigationActivities);
    const start = (runId: string) =>
      acts.startInvestigation({
        incidentId: incident.id,
        workspaceId: ws,
        workflowId: `incident-${incident.id}`,
        runId,
        attempt: 1,
        note: null,
      });

    await db
      .insert(usageRecords)
      .values({ workspaceId: ws, metric: 'model_cost_usd', quantity: '5' });
    await owner
      .put(`/workspaces/${ws}/usage/limits`)
      .send({ monthlyAiBudgetUsd: 5, maxConcurrentInvestigations: null })
      .expect(200);
    const refused = await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'investigate' })
      .expect(409);
    expect((refused.body as ApiError).code).toBe('usage_limit_reached');
    expect((refused.body as ApiError).message).toContain('monthly AI budget of $5.00');
    expect(requested).not.toHaveBeenCalled();

    const auto = await start('run-1');
    expect(auto.blocked).toContain('monthly AI budget');
    expect(await start('run-1')).toEqual(auto);
    const [inv] = await db
      .select()
      .from(investigations)
      .where(eq(investigations.id, auto.investigationId));
    expect(inv?.status).toBe('failed');

    const timeline = (
      await owner.get(`/workspaces/${ws}/incidents/${incident.id}/timeline`).expect(200)
    ).body as TimelineEntry[];
    const blockedEntries = timeline.filter(
      (e) => e.kind === 'investigation' && e.summary?.startsWith('AI investigation not started'),
    );
    expect(blockedEntries).toHaveLength(2);
    const audits = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.workspaceId, ws), eq(auditEvents.action, 'investigation.blocked')));
    expect(audits.map((a) => a.outcome)).toEqual(['denied', 'denied']);

    await owner
      .put(`/workspaces/${ws}/usage/limits`)
      .send({ monthlyAiBudgetUsd: null, maxConcurrentInvestigations: 1 })
      .expect(200);
    const first = await start('run-2');
    expect(first.blocked).toBeUndefined();
    const second = await start('run-3');
    expect(second.blocked).toContain('1 investigation is already running (limit 1)');

    await owner
      .put(`/workspaces/${ws}/usage/limits`)
      .send({ monthlyAiBudgetUsd: null, maxConcurrentInvestigations: null })
      .expect(200);
    await owner
      .post(`/workspaces/${ws}/incidents/${incident.id}/actions`)
      .send({ action: 'investigate' })
      .expect(200);
    expect(requested).toHaveBeenCalledTimes(1);
  });
});
