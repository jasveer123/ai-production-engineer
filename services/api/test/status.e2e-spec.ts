import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { MonitorView, PublicStatus, StatusPageView } from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Mailer } from '../src/modules/auth/infrastructure/mailer.service';
import { StatusAutomationService } from '../src/modules/status/application/status-automation.service';
import { StatusService } from '../src/modules/status/application/status.service';
import { MonitorsService } from '../src/modules/alerts/application/monitors.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Status pages (e2e)', () => {
  let app: INestApplication<App>;
  let target: Server;
  let url: string;
  let status = 200;

  beforeAll(async () => {
    app = await createTestApp();
    target = createServer((_req, res) => {
      res.statusCode = status;
      res.end('ok');
    });
    await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(target.address() as AddressInfo).port}/`;
  });
  beforeEach(async () => {
    status = 200;
    await resetDatabase();
  });
  afterAll(async () => {
    await new Promise((resolve) => target.close(resolve));
    await app.close();
  });

  it('publishes monitors and updates on a public page without sign-in', async () => {
    const owner = await loginAs(app, 'owner@status.test');
    const ws = (await createWorkspace(owner, 'Status')).id;
    const monitor = (
      await owner
        .post(`/workspaces/${ws}/monitors`)
        .send({
          name: 'Shop',
          kind: 'status',
          url,
          expectedStatus: 200,
          intervalSeconds: 30,
          confirmations: 1,
        })
        .expect(201)
    ).body as MonitorView;

    const page = (
      await owner
        .post(`/workspaces/${ws}/status-pages`)
        .send({ name: 'Acme status', slug: 'Acme', monitorIds: [monitor.id] })
        .expect(201)
    ).body as StatusPageView;
    expect(page.slug).toBe('acme');
    await owner
      .post(`/workspaces/${ws}/status-pages`)
      .send({ name: 'Other', slug: 'acme' })
      .expect(409);

    await app.get(MonitorsService).runDue();
    const publicAgent = request(app.getHttpServer());
    let view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.overall).toBe('operational');
    expect(view.components).toHaveLength(1);
    expect(view.components[0]).toMatchObject({ name: 'Shop', state: 'up', uptime: 100 });
    expect(view.components[0]!.days).toHaveLength(90);
    expect(view.components[0]!.days.at(-1)!.uptime).toBe(100);

    status = 500;
    await owner.post(`/workspaces/${ws}/monitors/${monitor.id}/check`).expect(200);
    view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.overall).toBe('outage');
    expect(view.components[0]!.uptime).toBe(50);

    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/updates`)
      .send({ title: 'Investigating checkout errors', state: 'investigating' })
      .expect(200);
    view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.updates[0]).toMatchObject({ state: 'investigating' });

    await publicAgent.get('/public/status/missing').expect(404);
  });

  it('keeps other workspaces monitors off a page', async () => {
    const owner = await loginAs(app, 'owner@status2.test');
    const ws = (await createWorkspace(owner, 'One')).id;
    const other = await loginAs(app, 'other@status2.test');
    const otherWs = (await createWorkspace(other, 'Two')).id;
    const foreign = (
      await other
        .post(`/workspaces/${otherWs}/monitors`)
        .send({ name: 'Theirs', kind: 'status', url, expectedStatus: 200 })
        .expect(201)
    ).body as MonitorView;
    await owner
      .post(`/workspaces/${ws}/status-pages`)
      .send({ name: 'Mine', slug: 'mine', monitorIds: [foreign.id] })
      .expect(404);
  });

  it('emails confirmed subscribers, auto-posts when a monitor goes down, and serves a verified domain', async () => {
    const owner = await loginAs(app, 'owner@status3.test');
    const ws = (await createWorkspace(owner, 'Status3')).id;
    const monitor = (
      await owner
        .post(`/workspaces/${ws}/monitors`)
        .send({
          name: 'Shop',
          kind: 'status',
          url,
          expectedStatus: 200,
          intervalSeconds: 30,
          confirmations: 1,
        })
        .expect(201)
    ).body as MonitorView;
    const page = (
      await owner
        .post(`/workspaces/${ws}/status-pages`)
        .send({ name: 'Acme', slug: 'acme3', monitorIds: [monitor.id] })
        .expect(201)
    ).body as StatusPageView;
    const mailer = app.get(Mailer);
    const http = request(app.getHttpServer());

    mailer.sent.length = 0;
    await http
      .post('/public/status/acme3/subscribe')
      .send({ email: 'Fan@Example.com' })
      .expect(202);
    await http.post('/public/status/acme3/subscribe').send({ email: 'not-an-email' }).expect(400);
    const confirmMail = mailer.sent.at(-1)!;
    expect(confirmMail.to).toBe('fan@example.com');
    const token = /token=([a-f0-9]+)/.exec(confirmMail.text)![1]!;

    mailer.sent.length = 0;
    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/updates`)
      .send({ title: 'Before confirming', state: 'investigating' })
      .expect(200);
    expect(mailer.sent).toHaveLength(0);

    await http.get(`/public/status/subscriptions/confirm?token=${token}`).expect(200);
    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/updates`)
      .send({ title: 'Checkout slow', state: 'identified' })
      .expect(200);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.subject).toContain('Checkout slow');

    const automation = app.get(StatusAutomationService);
    await app.get(MonitorsService).runDue();
    await automation.tick();
    mailer.sent.length = 0;
    status = 500;
    await owner.post(`/workspaces/${ws}/monitors/${monitor.id}/check`).expect(200);
    expect(await automation.tick()).toBe(1);
    expect(await automation.tick()).toBe(0);
    status = 200;
    await owner.post(`/workspaces/${ws}/monitors/${monitor.id}/check`).expect(200);
    expect(await automation.tick()).toBe(1);
    const view = (await http.get('/public/status/acme3').expect(200)).body as PublicStatus;
    expect(view.updates.slice(0, 2).map((u) => [u.state, u.auto])).toEqual([
      ['resolved', true],
      ['investigating', true],
    ]);
    expect(mailer.sent.map((m) => m.subject)).toEqual(
      [
        expect.stringContaining('Shop is back up'),
        expect.stringContaining('Shop is down'),
      ].reverse(),
    );

    await http.get(`/public/status/subscriptions/unsubscribe?token=${token}`).expect(200);
    await http.get(`/public/status/subscriptions/unsubscribe?token=${token}`).expect(404);

    const withDomain = (
      await owner
        .patch(`/workspaces/${ws}/status-pages/${page.id}`)
        .send({ customDomain: 'Status.Acme.test' })
        .expect(200)
    ).body as StatusPageView;
    expect(withDomain).toMatchObject({ customDomain: 'status.acme.test', domainVerified: false });
    await http.get('/public/status/domain/status.acme.test').expect(404);
    const svc = app.get(StatusService);
    svc.resolveTxt = () => Promise.resolve([['wrong']]);
    await owner.post(`/workspaces/${ws}/status-pages/${page.id}/verify-domain`).expect(422);
    svc.resolveTxt = () => Promise.resolve([[`pramaan-verify=${withDomain.domainToken}`]]);
    await owner.post(`/workspaces/${ws}/status-pages/${page.id}/verify-domain`).expect(200);
    const byDomain = (await http.get('/public/status/domain/status.acme.test').expect(200))
      .body as PublicStatus;
    expect(byDomain.name).toBe('Acme');
    await owner
      .patch(`/workspaces/${ws}/status-pages/${page.id}`)
      .send({ customDomain: 'nope' })
      .expect(400);
  });
});
