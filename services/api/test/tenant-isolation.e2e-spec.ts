import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface RouteInfo {
  method: string;
  path: string;
}

/** Reads every registered Express route so new routes are covered without editing this test. */
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

    // Bob's data is untouched and still visible to Bob.
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
});
