import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { AlertView, MonitorDetail, MonitorView } from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MonitorsService } from '../src/modules/alerts/application/monitors.service';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Uptime monitors (e2e)', () => {
  let app: INestApplication<App>;
  let target: Server;
  let url: string;
  let status = 200;
  let body = 'hello from the shop';

  beforeAll(async () => {
    app = await createTestApp();
    target = createServer((_req, res) => {
      res.statusCode = status;
      res.end(body);
    });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(target.address() as AddressInfo).port}/`;
  });
  beforeEach(async () => {
    status = 200;
    body = 'hello from the shop';
    await resetDatabase();
  });
  afterAll(async () => {
    await new Promise((resolve) => target.close(resolve));
    await app.close();
  });

  async function setup() {
    const owner = await loginAs(app, 'owner@monitors.test');
    const ws = (await createWorkspace(owner, 'Monitors')).id;
    return { owner, ws };
  }

  const create = (owner: ReturnType<typeof request.agent>, ws: string, extra = {}) =>
    owner.post(`/workspaces/${ws}/monitors`).send({
      name: 'Shop home',
      kind: 'keyword',
      url,
      keyword: 'hello',
      intervalSeconds: 30,
      confirmations: 1,
      ...extra,
    });

  it('checks on schedule, goes down, opens an alert and recovers', async () => {
    const { owner, ws } = await setup();
    const created = (await create(owner, ws).expect(201)).body as MonitorView;
    expect(created.state).toBe('pending');

    expect(await app.get(MonitorsService).runDue()).toBe(1);
    expect(await app.get(MonitorsService).runDue()).toBe(0);
    let list = (await owner.get(`/workspaces/${ws}/monitors`).expect(200)).body as MonitorView[];
    expect(list[0]).toMatchObject({ state: 'up', lastStatusCode: 200 });

    status = 500;
    let detail = (await owner.post(`/workspaces/${ws}/monitors/${created.id}/check`).expect(200))
      .body as MonitorDetail;
    expect(detail).toMatchObject({ state: 'down', lastStatusCode: 500, lastError: 'HTTP 500' });
    expect(detail.recent).toHaveLength(2);
    expect(detail.history).toHaveLength(48);
    expect(detail.uptime24h).toBe(50);

    await app.get(IngestionProcessor).processBatch();
    let alerts = (await owner.get(`/workspaces/${ws}/alerts`).expect(200)).body as AlertView[];
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ status: 'firing', title: 'Monitor "Shop home" is down' });

    status = 200;
    detail = (await owner.post(`/workspaces/${ws}/monitors/${created.id}/check`).expect(200))
      .body as MonitorDetail;
    expect(detail.state).toBe('up');
    await app.get(IngestionProcessor).processBatch();
    alerts = (await owner.get(`/workspaces/${ws}/alerts`).expect(200)).body as AlertView[];
    expect(alerts[0]!.status).toBe('resolved');
    list = (await owner.get(`/workspaces/${ws}/monitors`).expect(200)).body as MonitorView[];
    expect(list[0]!.state).toBe('up');
  });

  it('waits for the confirmation checks before declaring a monitor down', async () => {
    const { owner, ws } = await setup();
    const created = (await create(owner, ws, { confirmations: 2 }).expect(201)).body as MonitorView;
    await owner.post(`/workspaces/${ws}/monitors/${created.id}/check`).expect(200);
    status = 503;
    const first = (await owner.post(`/workspaces/${ws}/monitors/${created.id}/check`).expect(200))
      .body as MonitorDetail;
    expect(first.state).toBe('up');
    const second = (await owner.post(`/workspaces/${ws}/monitors/${created.id}/check`).expect(200))
      .body as MonitorDetail;
    expect(second.state).toBe('down');
  });

  it('fails a keyword check when the word is missing and supports the absent mode', async () => {
    const { owner, ws } = await setup();
    body = 'maintenance page';
    const present = (await create(owner, ws).expect(201)).body as MonitorView;
    const result = (await owner.post(`/workspaces/${ws}/monitors/${present.id}/check`).expect(200))
      .body as MonitorDetail;
    expect(result.lastError).toBe('The page does not contain "hello"');
    const absent = (
      await create(owner, ws, {
        name: 'No maintenance',
        keyword: 'maintenance',
        keywordMode: 'absent',
      }).expect(201)
    ).body as MonitorView;
    const absentResult = (
      await owner.post(`/workspaces/${ws}/monitors/${absent.id}/check`).expect(200)
    ).body as MonitorDetail;
    expect(absentResult.state).toBe('down');
    expect(absentResult.lastError).toBe('The page contains "maintenance"');
  });

  it('checks a TCP port and a status code', async () => {
    const { owner, ws } = await setup();
    const port = Number(new URL(url).port);
    const tcp = (
      await owner
        .post(`/workspaces/${ws}/monitors`)
        .send({ name: 'Port', kind: 'tcp', host: '127.0.0.1', port, confirmations: 1 })
        .expect(201)
    ).body as MonitorView;
    expect(
      (
        (await owner.post(`/workspaces/${ws}/monitors/${tcp.id}/check`).expect(200))
          .body as MonitorDetail
      ).state,
    ).toBe('up');
    status = 404;
    const code = (
      await owner
        .post(`/workspaces/${ws}/monitors`)
        .send({ name: 'Gone', kind: 'status', url, expectedStatus: 404 })
        .expect(201)
    ).body as MonitorView;
    expect(
      (
        (await owner.post(`/workspaces/${ws}/monitors/${code.id}/check`).expect(200))
          .body as MonitorDetail
      ).state,
    ).toBe('up');
  });

  it('pauses, updates and deletes, and keeps monitors per workspace', async () => {
    const { owner, ws } = await setup();
    const created = (await create(owner, ws).expect(201)).body as MonitorView;
    await owner
      .patch(`/workspaces/${ws}/monitors/${created.id}`)
      .send({ paused: true })
      .expect(200);
    expect(await app.get(MonitorsService).runDue()).toBe(0);

    const other = await loginAs(app, 'other@monitors.test');
    const otherWs = (await createWorkspace(other, 'Other')).id;
    await other.get(`/workspaces/${otherWs}/monitors/${created.id}`).expect(404);
    expect((await other.get(`/workspaces/${otherWs}/monitors`).expect(200)).body).toEqual([]);

    await owner.delete(`/workspaces/${ws}/monitors/${created.id}`).expect(204);
    await owner.get(`/workspaces/${ws}/monitors/${created.id}`).expect(404);
  });

  it('rejects incomplete monitors and anonymous callers', async () => {
    const { owner, ws } = await setup();
    await owner.post(`/workspaces/${ws}/monitors`).send({ name: 'x', kind: 'tcp' }).expect(400);
    await owner.post(`/workspaces/${ws}/monitors`).send({ name: 'x', kind: 'http' }).expect(400);
    await owner
      .post(`/workspaces/${ws}/monitors`)
      .send({ name: 'x', kind: 'keyword', url })
      .expect(400);
    await request(app.getHttpServer()).get(`/workspaces/${ws}/monitors`).expect(401);
  });
});
