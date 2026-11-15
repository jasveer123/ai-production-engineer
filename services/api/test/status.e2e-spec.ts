import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type {
  CreatedReport,
  MonitorView,
  NotificationView,
  PublicStatus,
  StatusPageView,
  StructureView,
} from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Mailer } from '../src/modules/auth/infrastructure/mailer.service';
import { StatusAutomationService } from '../src/modules/status/application/status-automation.service';
import { StatusService } from '../src/modules/status/application/status.service';
import { MonitorExecutor } from '../src/modules/alerts/application/monitor-executor.service';
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
  afterEach(() => jest.restoreAllMocks());
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
          expectedStatuses: [200],
          intervalSeconds: 30,
          confirmationSeconds: 0,
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

    await app.get(MonitorExecutor).runDue();
    const publicAgent = request(app.getHttpServer());
    let view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.overall).toBe('operational');
    const resources = view.sections.flatMap((s) => s.resources);
    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({ name: 'Shop', state: 'operational', uptime: 100 });
    expect(resources[0]!.days).toHaveLength(90);
    expect(resources[0]!.days.at(-1)!.uptime).toBe(100);
    expect(JSON.stringify(view)).not.toContain(url);

    status = 500;
    await owner.post(`/workspaces/${ws}/monitors/${monitor.id}/check`).expect(200);
    view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.overall).toBe('outage');
    expect(view.sections[0]!.resources[0]!.uptime).toBe(50);

    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/reports`)
      .send({ title: 'Investigating checkout errors', state: 'investigating' })
      .expect(201);
    view = (await publicAgent.get('/public/status/acme').expect(200)).body as PublicStatus;
    expect(view.reports[0]).toMatchObject({ state: 'investigating' });

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
        .send({ name: 'Theirs', kind: 'status', url, expectedStatuses: [200] })
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
          expectedStatuses: [200],
          intervalSeconds: 30,
          confirmationSeconds: 0,
          recoverySeconds: 0,
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
    const record = mailer.send.bind(mailer);
    // The test env has no mail transport; stand in for one that accepts every message.
    jest.spyOn(mailer, 'send').mockImplementation(async (mail) => {
      await record(mail);
      return { state: 'accepted', providerMessageId: null };
    });
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

    const automation = app.get(StatusAutomationService);
    mailer.sent.length = 0;
    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/reports`)
      .send({ title: 'Before confirming', state: 'investigating' })
      .expect(201);
    await automation.tick();
    expect(mailer.sent).toHaveLength(0);

    await http.get(`/public/status/subscriptions/confirm?token=${token}`).expect(200);
    await http.get(`/public/status/subscriptions/confirm?token=${token}`).expect(404);
    const report = (
      await owner
        .post(`/workspaces/${ws}/status-pages/${page.id}/reports`)
        .send({ title: 'Checkout slow', state: 'identified' })
        .expect(201)
    ).body as CreatedReport;
    expect(report.fanout).toBe('queued');
    expect(mailer.sent).toHaveLength(0);
    await automation.tick();
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.subject).toContain('Checkout slow');
    const unsubscribeToken = /unsubscribe\?token=([a-f0-9]+)/.exec(mailer.sent[0]!.text)![1]!;
    expect(unsubscribeToken).not.toBe(token);
    const ledger = (
      await owner.get(`/workspaces/${ws}/status-pages/${page.id}/notifications`).expect(200)
    ).body as NotificationView[];
    expect(ledger[0]!.counts).toMatchObject({ sent: 1, failed: 0 });

    await app.get(MonitorExecutor).runDue();
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
    const auto = view.reports.find((r) => r.auto)!;
    expect(auto.state).toBe('resolved');
    expect(auto.updates.map((u) => u.state)).toEqual(['resolved', 'investigating']);
    expect(mailer.sent.map((m) => m.subject)).toEqual([
      expect.stringContaining('Shop is down'),
      expect.stringContaining('Shop is back up'),
    ]);

    await http
      .get(`/public/status/subscriptions/unsubscribe?token=${unsubscribeToken}`)
      .expect(200);
    await http.get(`/public/status/subscriptions/unsubscribe?token=${token}`).expect(404);
    mailer.sent.length = 0;
    await owner
      .post(`/workspaces/${ws}/status-pages/${page.id}/reports`)
      .send({ title: 'After leaving', state: 'investigating' })
      .expect(201);
    await automation.tick();
    expect(mailer.sent).toHaveLength(0);

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

  it('updates each page once when one monitor is linked to two pages', async () => {
    const owner = await loginAs(app, 'owner@status4.test');
    const ws = (await createWorkspace(owner, 'Status4')).id;
    const monitor = (
      await owner
        .post(`/workspaces/${ws}/monitors`)
        .send({
          name: 'Private API name',
          kind: 'status',
          url,
          expectedStatuses: [200],
          confirmationSeconds: 0,
        })
        .expect(201)
    ).body as MonitorView;
    const pages: StatusPageView[] = [];
    for (const slug of ['one-page', 'two-page'])
      pages.push(
        (
          await owner
            .post(`/workspaces/${ws}/status-pages`)
            .send({ name: slug, slug, monitorIds: [monitor.id] })
            .expect(201)
        ).body as StatusPageView,
      );
    const structure = (
      await owner.get(`/workspaces/${ws}/status-pages/${pages[0]!.id}/structure`).expect(200)
    ).body as StructureView;
    await owner
      .put(`/workspaces/${ws}/status-pages/${pages[0]!.id}/structure`)
      .send({
        sections: [
          {
            id: structure.sections[0]!.id,
            name: 'Core',
            resources: [
              { ...structure.sections[0]!.resources[0]!, publicName: 'Checkout' },
              { publicName: 'Docs', monitorIds: [], manualState: 'degraded' },
            ],
          },
        ],
      })
      .expect(200);

    const automation = app.get(StatusAutomationService);
    await app.get(MonitorExecutor).runDue();
    expect(await automation.tick()).toBe(0);
    status = 500;
    await owner.post(`/workspaces/${ws}/monitors/${monitor.id}/check`).expect(200);
    expect(await automation.tick()).toBe(2);
    expect(await automation.tick()).toBe(0);

    const http = request(app.getHttpServer());
    const one = (await http.get('/public/status/one-page').expect(200)).body as PublicStatus;
    const two = (await http.get('/public/status/two-page').expect(200)).body as PublicStatus;
    expect(one.reports.filter((r) => r.auto)).toHaveLength(1);
    expect(two.reports.filter((r) => r.auto)).toHaveLength(1);
    expect(one.reports[0]!.title).toBe('Checkout is down');
    expect(one.sections[0]).toMatchObject({ name: 'Core' });
    expect(one.sections[0]!.resources.map((r) => r.state)).toEqual(['downtime', 'degraded']);
    expect(JSON.stringify(one)).not.toContain('Private API name');
  });

  it('gates a private page behind its password', async () => {
    const owner = await loginAs(app, 'owner@status5.test');
    const ws = (await createWorkspace(owner, 'Status5')).id;
    const page = (
      await owner
        .post(`/workspaces/${ws}/status-pages`)
        .send({ name: 'Secret', slug: 'secret' })
        .expect(201)
    ).body as StatusPageView;
    await owner
      .patch(`/workspaces/${ws}/status-pages/${page.id}`)
      .send({ password: 'correct horse', hideFromSearch: true })
      .expect(200);
    const http = request(app.getHttpServer());
    await http.get('/public/status/secret').expect(401);
    await http.post('/public/status/secret/access').send({ password: 'wrong one' }).expect(401);
    const { token } = (
      await http
        .post('/public/status/secret/access')
        .send({ password: 'correct horse' })
        .expect(200)
    ).body as { token: string };
    const res = await http.get('/public/status/secret').set('x-status-access', token).expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect((res.body as PublicStatus).hideFromSearch).toBe(true);
  });
});
