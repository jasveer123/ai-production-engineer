import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface RouteInfo {
  method: string;
  path: string;
}

function workspaceRoutes(app: INestApplication<App>): RouteInfo[] {
  const router = (
    app.getHttpAdapter().getInstance() as {
      router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] };
    }
  ).router;
  return router.stack
    .filter((layer) => layer.route?.path.includes(':workspaceId'))
    .flatMap((layer) =>
      Object.keys(layer.route!.methods).map((m) => ({
        method: m.toUpperCase(),
        path: layer.route!.path,
      })),
    );
}

const fill = (path: string, workspaceId: string) =>
  path.replace(':workspaceId', workspaceId).replace(/:[A-Za-z]+/g, () => randomUUID());

describe('Tenant isolation and RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let routes: RouteInfo[];

  beforeAll(async () => {
    app = await createTestApp();
    routes = workspaceRoutes(app);
  });
  beforeEach(resetDatabase);
  afterAll(() => app.close());

  it('discovers the workspace-scoped routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it('returns 404 on every workspace route for a user from another workspace', async () => {
    const alice = await loginAs(app, 'alice@a.test');
    const bob = await loginAs(app, 'bob@b.test');
    await createWorkspace(alice, 'Workspace A');
    const wsB = await createWorkspace(bob, 'Workspace B');
    await bob
      .post(`/workspaces/${wsB.id}/services`)
      .send({ name: 'b-api', environment: 'prod' })
      .expect(201);

    for (const route of routes) {
      const url = fill(route.path, wsB.id);
      const res = await alice[route.method.toLowerCase() as 'get'](url).send({});
      expect({ route: `${route.method} ${route.path}`, status: res.status }).toEqual({
        route: `${route.method} ${route.path}`,
        status: 404,
      });
    }

    const list = await bob.get(`/workspaces/${wsB.id}/services`).expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects every mutating workspace route for a viewer with 403', async () => {
    const owner = await loginAs(app, 'owner@a.test');
    const ws = await createWorkspace(owner, 'Workspace A');
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'viewer@a.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'viewer@a.test');

    const mutating = routes.filter((r) => r.method !== 'GET');
    expect(mutating.length).toBeGreaterThan(0);
    for (const route of mutating) {
      const res = await viewer[route.method.toLowerCase() as 'post'](fill(route.path, ws.id)).send(
        {},
      );
      expect({ route: `${route.method} ${route.path}`, status: res.status }).toEqual({
        route: `${route.method} ${route.path}`,
        status: 403,
      });
    }
    await viewer.get(`/workspaces/${ws.id}/services`).expect(200);
  });

  it('hides workspace A resources from workspace B even when B uses their real ids', async () => {
    const alice = await loginAs(app, 'alice@a.test');
    const bob = await loginAs(app, 'bob@b.test');
    const a = (await createWorkspace(alice, 'Workspace A')).id;
    const b = (await createWorkspace(bob, 'Workspace B')).id;
    const create = async (path: string, body: object) =>
      (await alice.post(`/workspaces/${a}/${path}`).send(body).expect(201)).body as { id: string };

    const ids = {
      serviceId: (await create('services', { name: 'a-api', environment: 'prod' })).id,
      incidentId: (await create('incidents', { title: 'A is on fire' })).id,
      routeId: (await create('alert-routes', { name: 'A route' })).id,
      sourceId: (await create('alert-sources', { kind: 'http', name: 'A source' })).id,
      tokenId: (await create('ingest/tokens', { name: 'A token' })).id,
      integrationId: (await create('integrations', { provider: 'deploy_webhook', name: 'A hook' }))
        .id,
      channelId: (
        await create('notifications/channels', {
          kind: 'webhook',
          name: 'A channel',
          url: 'https://example.com/hook',
          events: ['incident.detected'],
        })
      ).id,
      invitationId: (await create('invitations', { email: 'new@a.test', role: 'viewer' })).id,
    };
    const memberId = (
      (await alice.get(`/workspaces/${a}/members`).expect(200)).body as { id: string }[]
    )[0]!.id;

    const attempts: [method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object][] = [
      ['get', `services/${ids.serviceId}`],
      ['patch', `services/${ids.serviceId}`, { name: 'hijacked' }],
      ['delete', `services/${ids.serviceId}`],
      ['get', `incidents/${ids.incidentId}`],
      ['get', `incidents/${ids.incidentId}/timeline`],
      [
        'post',
        `incidents/${ids.incidentId}/transitions`,
        { to: 'closed_without_fix', expectedVersion: 1 },
      ],
      ['patch', `alert-routes/${ids.routeId}`, { name: 'hijacked' }],
      ['delete', `alert-routes/${ids.routeId}`],
      ['post', `alert-sources/${ids.sourceId}/rotate-token`],
      ['delete', `alert-sources/${ids.sourceId}`],
      ['post', `ingest/tokens/${ids.tokenId}/rotate`],
      ['delete', `ingest/tokens/${ids.tokenId}`],
      ['post', `integrations/${ids.integrationId}/test`],
      ['post', `integrations/${ids.integrationId}/rotate-secret`],
      ['delete', `integrations/${ids.integrationId}`],
      ['patch', `notifications/channels/${ids.channelId}`, { name: 'hijacked' }],
      ['delete', `notifications/channels/${ids.channelId}`],
      ['patch', `members/${memberId}`, { role: 'viewer' }],
      ['delete', `members/${memberId}`],
      ['delete', `invitations/${ids.invitationId}`],
    ];
    for (const [method, path, body] of attempts) {
      const res = await bob[method](`/workspaces/${b}/${path}`).send(body ?? {});
      expect({ attempt: `${method} ${path}`, status: res.status }).toEqual({
        attempt: `${method} ${path}`,
        status: 404,
      });
    }

    const service = await alice.get(`/workspaces/${a}/services/${ids.serviceId}`).expect(200);
    expect((service.body as { name: string }).name).toBe('a-api');
    const incident = await alice.get(`/workspaces/${a}/incidents/${ids.incidentId}`).expect(200);
    expect((incident.body as { status: string }).status).toBe('detected');
    const route = await alice.get(`/workspaces/${a}/alert-routes`).expect(200);
    expect(route.body).toHaveLength(1);
    const sources = await alice.get(`/workspaces/${a}/alert-sources`).expect(200);
    expect(sources.body).toHaveLength(1);
    const members = await alice.get(`/workspaces/${a}/members`).expect(200);
    expect(members.body).toHaveLength(1);
    const channels = await alice.get(`/workspaces/${a}/notifications/channels`).expect(200);
    expect((channels.body as { name: string }[])[0]!.name).toBe('A channel');
    const invitations = await alice.get(`/workspaces/${a}/invitations`).expect(200);
    expect(invitations.body).toHaveLength(1);
  });
});
