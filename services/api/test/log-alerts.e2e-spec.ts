import type { INestApplication } from '@nestjs/common';
import type { AlertView, Incident, LogAlertView } from '@ape/api-contracts';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import { logRecords } from '../src/core/db/schema';
import { LogAlertsService } from '../src/modules/alerts/application/log-alerts.service';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Log alerts (e2e)', () => {
  let app: INestApplication<App>;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase());
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  const log = (ws: string, service: string, level: string, message: string, ago = 0) => ({
    workspaceId: ws,
    ts: new Date(Date.now() - ago),
    service,
    environment: 'production',
    level,
    message,
    way: 'test',
  });

  it('fires an incident when matching logs pass the limit and resolves when they stop', async () => {
    const owner = await loginAs(app, 'owner@logalerts.test');
    const ws = (await createWorkspace(owner, 'LogAlerts')).id;
    await owner.post(`/workspaces/${ws}/alert-routes`).send({ name: 'All' }).expect(201);
    const alert = (
      await owner
        .post(`/workspaces/${ws}/log-alerts`)
        .send({
          name: 'Checkout errors',
          service: 'checkout',
          levels: ['error'],
          contains: 'timeout',
          threshold: 3,
          windowMinutes: 5,
          severity: 'critical',
        })
        .expect(201)
    ).body as LogAlertView;
    expect(alert.state).toBe('ok');

    await db
      .insert(logRecords)
      .values([
        log(ws, 'checkout', 'error', 'Upstream TIMEOUT after 5s'),
        log(ws, 'checkout', 'error', 'db timeout'),
        log(ws, 'checkout', 'info', 'timeout noted'),
        log(ws, 'search', 'error', 'timeout'),
        log(ws, 'checkout', 'error', 'timeout long ago', 60 * 60_000),
      ]);
    let checked = (await owner.post(`/workspaces/${ws}/log-alerts/${alert.id}/check`).expect(200))
      .body as LogAlertView;
    expect(checked).toMatchObject({ state: 'ok', lastCount: 2 });

    await db.insert(logRecords).values(log(ws, 'checkout', 'error', 'read timeout'));
    checked = (await owner.post(`/workspaces/${ws}/log-alerts/${alert.id}/check`).expect(200))
      .body as LogAlertView;
    expect(checked).toMatchObject({ state: 'firing', lastCount: 3 });

    await app.get(IngestionProcessor).processBatch();
    const alerts = (await owner.get(`/workspaces/${ws}/alerts`).expect(200)).body as AlertView[];
    expect(alerts[0]).toMatchObject({ status: 'firing', severity: 'critical' });
    const incidents = (await owner.get(`/workspaces/${ws}/incidents?status=open`).expect(200))
      .body as { items: Incident[] } | Incident[];
    expect(Array.isArray(incidents) ? incidents : incidents.items).toHaveLength(1);

    const later = new Date(Date.now() + 10 * 60_000);
    await app.get(LogAlertsService).runDue(later);
    const list = (await owner.get(`/workspaces/${ws}/log-alerts`).expect(200))
      .body as LogAlertView[];
    expect(list[0]).toMatchObject({ state: 'ok', lastCount: 0 });
  });

  it('only lets admins create rules', async () => {
    const owner = await loginAs(app, 'owner@logalerts2.test');
    const ws = (await createWorkspace(owner, 'LogAlerts2')).id;
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@logalerts2.test', role: 'engineer' })
      .expect(201);
    const eng = await loginAs(app, 'eng@logalerts2.test');
    await eng.post(`/workspaces/${ws}/log-alerts`).send({ name: 'x' }).expect(403);
  });

  it('edits a rule and clears optional filters', async () => {
    const owner = await loginAs(app, 'owner@logalerts3.test');
    const ws = (await createWorkspace(owner, 'LogAlerts3')).id;
    const alert = (
      await owner
        .post(`/workspaces/${ws}/log-alerts`)
        .send({ name: 'A', service: 'checkout', contains: 'timeout' })
        .expect(201)
    ).body as LogAlertView;
    const edited = (
      await owner
        .patch(`/workspaces/${ws}/log-alerts/${alert.id}`)
        .send({ name: 'B', service: null, contains: null, threshold: 4 })
        .expect(200)
    ).body as LogAlertView;
    expect(edited).toMatchObject({ name: 'B', service: null, contains: null, threshold: 4 });
  });
});
