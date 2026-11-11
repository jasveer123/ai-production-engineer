import { gzipSync } from 'node:zlib';
import type { INestApplication } from '@nestjs/common';
import type {
  FunnelResult,
  FunnelView,
  RumAppView,
  RumOverview,
  RumReplay,
  RumSessionDetail,
  RumSessionView,
  RumUserView,
} from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Real user monitoring (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetDatabase());
  afterAll(() => app.close());

  const post = (key: string, body: unknown, gzip = false) => {
    const r = request(app.getHttpServer())
      .post(`/v1/rum/${key}`)
      .set('Content-Type', 'application/json')
      .set(
        'User-Agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36',
      );
    return gzip
      ? r
          .set('Content-Encoding', 'gzip')
          .set('Content-Type', 'application/octet-stream')
          .send(gzipSync(JSON.stringify(body)))
      : r.send(JSON.stringify(body));
  };

  it('records sessions, events, vitals and replay, and answers dashboard queries', async () => {
    const owner = await loginAs(app, 'owner@rum.test');
    const ws = (await createWorkspace(owner, 'Rum')).id;
    const rumApp = (
      await owner.post(`/workspaces/${ws}/rum/apps`).send({ name: 'Shop' }).expect(201)
    ).body as RumAppView;
    expect(rumApp.appKey).toMatch(/^rum_[a-f0-9]{24}$/);

    await request(app.getHttpServer())
      .options(`/v1/rum/${rumApp.appKey}`)
      .set('Origin', 'https://shop.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('access-control-allow-origin', '*');
    await post('rum_unknown', {
      sessionId: 'sess-0000001',
      url: 'https://x.test/',
      events: [],
    }).expect(404);
    await post(rumApp.appKey, { sessionId: 'x', url: 'https://x.test/' }).expect(400);

    const now = Date.now();
    const session = (id: string, user: string | null, extra: object = {}) => ({
      sessionId: id,
      ...(user ? { userId: user, userEmail: `${user}@shop.test` } : {}),
      url: 'https://shop.test/pricing?token=abc123456789abcdef',
      viewport: { w: 1280, h: 720 },
      ...extra,
    });
    const ev = (
      ts: number,
      type: string,
      name = '',
      url = 'https://shop.test/pricing',
      value?: number,
    ) => ({
      ts,
      type,
      name,
      url,
      ...(value === undefined ? {} : { value }),
    });

    await post(
      rumApp.appKey,
      session('session-aaaa', 'ana', {
        events: [
          ev(now - 5000, 'pageview'),
          ev(now - 4900, 'vital', 'LCP', undefined, 1800),
          ev(now - 4000, 'custom', 'add_to_cart'),
          ev(now - 3000, 'pageview', '', 'https://shop.test/checkout/pay'),
          ev(now - 2000, 'error', 'TypeError: x is undefined'),
        ],
        replay: {
          snapshots: [{ ts: now - 5000, html: '<html><body><h1>Pricing</h1></body></html>' }],
          moves: [
            { ts: now - 4500, t: 'm', x: 10, y: 20 },
            { ts: now - 4400, t: 'c', x: 12, y: 22 },
          ],
        },
      }),
      true,
    ).expect(202);
    await post(
      rumApp.appKey,
      session('session-bbbb', 'bo', {
        events: [
          ev(now - 3500, 'pageview'),
          ev(now - 3400, 'vital', 'LCP', undefined, 3400),
          ev(now - 3300, 'custom', 'add_to_cart'),
        ],
      }),
    ).expect(202);
    await post(
      rumApp.appKey,
      session('session-aaaa', 'ana', { events: [ev(now - 1000, 'click', 'Buy')] }),
    ).expect(202);

    const sessions = (await owner.get(`/workspaces/${ws}/rum/sessions`).expect(200))
      .body as RumSessionView[];
    expect(sessions).toHaveLength(2);
    const ana = sessions.find((s) => s.userId === 'ana')!;
    expect(ana).toMatchObject({
      errors: 1,
      pageViews: 2,
      clicks: 1,
      hasReplay: true,
      browser: 'Chrome',
      os: 'macOS',
      device: 'desktop',
      userEmail: 'ana@shop.test',
    });
    expect(ana.entryUrl).not.toContain('abc123456789abcdef');
    expect(
      (
        (await owner.get(`/workspaces/${ws}/rum/sessions`).query({ hasErrors: 'true' }).expect(200))
          .body as unknown[]
      ).length,
    ).toBe(1);

    const detail = (await owner.get(`/workspaces/${ws}/rum/sessions/${ana.id}`).expect(200))
      .body as RumSessionDetail;
    expect(detail.events.map((e) => e.type)).toEqual([
      'pageview',
      'vital',
      'custom',
      'pageview',
      'error',
      'click',
    ]);

    const replay = (await owner.get(`/workspaces/${ws}/rum/sessions/${ana.id}/replay`).expect(200))
      .body as RumReplay;
    expect(replay.viewport).toEqual({ w: 1280, h: 720 });
    expect(replay.snapshots[0]!.html).toContain('Pricing');
    expect(replay.moves.map((m) => m.t)).toEqual(['m', 'c']);

    const overview = (await owner.get(`/workspaces/${ws}/rum/overview`).expect(200))
      .body as RumOverview;
    expect(overview).toMatchObject({ sessions: 2, users: 2, pageViews: 3, errors: 1 });
    expect(overview.vitals.find((v) => v.name === 'LCP')).toMatchObject({ samples: 2 });
    expect(overview.vitals.find((v) => v.name === 'LCP')!.p75).toBeCloseTo(3000, 0);
    expect(overview.topPages[0]).toMatchObject({ views: 2 });
    expect(overview.trend).toHaveLength(24);

    const users = (await owner.get(`/workspaces/${ws}/rum/users`).expect(200))
      .body as RumUserView[];
    expect(users.map((u) => u.userId).sort()).toEqual(['ana', 'bo']);

    const funnel = (
      await owner
        .post(`/workspaces/${ws}/rum/funnels`)
        .send({
          appId: rumApp.id,
          name: 'Checkout',
          steps: [
            { kind: 'pageview', match: '/pricing' },
            { kind: 'event', match: 'add_to_cart', label: 'Added to cart' },
            { kind: 'pageview', match: '/checkout/*' },
          ],
        })
        .expect(201)
    ).body as FunnelView;
    const result = (
      await owner.get(`/workspaces/${ws}/rum/funnels/${funnel.id}/result`).expect(200)
    ).body as FunnelResult;
    expect(result.steps.map((s) => s.sessions)).toEqual([2, 2, 1]);
    expect(result.steps[2]).toMatchObject({ conversion: 50, dropOff: 1 });
    expect(result.steps[1]!.label).toBe('Added to cart');
  });

  it('keeps applications private to their workspace', async () => {
    const a = await loginAs(app, 'a@rum.test');
    const wsA = (await createWorkspace(a, 'Alpha')).id;
    const b = await loginAs(app, 'b@rum.test');
    const wsB = (await createWorkspace(b, 'Beta')).id;
    const appA = (await a.post(`/workspaces/${wsA}/rum/apps`).send({ name: 'A' }).expect(201))
      .body as RumAppView;
    expect(
      ((await b.get(`/workspaces/${wsB}/rum/apps`).expect(200)).body as unknown[]).length,
    ).toBe(0);
    await b.delete(`/workspaces/${wsB}/rum/apps/${appA.id}`).expect(404);
    await b
      .post(`/workspaces/${wsB}/rum/funnels`)
      .send({
        appId: appA.id,
        name: 'x',
        steps: [
          { kind: 'pageview', match: '/' },
          { kind: 'pageview', match: '/b' },
        ],
      })
      .expect(404);
  });
});
