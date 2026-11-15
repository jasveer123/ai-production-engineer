import type { INestApplication } from '@nestjs/common';
import type { ApiTokenView, ApiTokenWithSecret } from '@ape/api-contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import { apiTokens } from '../src/core/db/schema';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Personal API tokens (e2e)', () => {
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

  it('lets a script call the API with a token until it is revoked or expires', async () => {
    const owner = await loginAs(app, 'owner@pat.test');
    const ws = (await createWorkspace(owner, 'Pat')).id;
    const created = (
      await owner.post('/auth/api-tokens').send({ name: 'CI script', workspaceId: ws }).expect(201)
    ).body as ApiTokenWithSecret;
    expect(created.token).toMatch(/^ape_pat_[a-f0-9]{48}$/);

    const listed = (await owner.get('/auth/api-tokens').expect(200)).body as ApiTokenView[];
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(created.token);

    const call = (token: string) =>
      request(app.getHttpServer())
        .get(`/workspaces/${ws}/incidents`)
        .set('Authorization', `Bearer ${token}`);
    await call(created.token).expect(200);
    await call('ape_pat_' + '0'.repeat(48)).expect(401);
    await request(app.getHttpServer())
      .post('/auth/api-tokens')
      .set('Authorization', `Bearer ${created.token}`)
      .send({ name: 'nested', workspaceId: ws })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${ws}/incidents`)
      .set('Authorization', `Bearer ${created.token}`)
      .expect(200);

    await db.update(apiTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    await call(created.token).expect(401);
    await db.update(apiTokens).set({ expiresAt: null });
    await call(created.token).expect(200);

    await owner.delete(`/auth/api-tokens/${created.id}`).expect(204);
    await call(created.token).expect(401);
    await owner.delete(`/auth/api-tokens/${created.id}`).expect(404);
  });

  it('keeps tokens private to their owner', async () => {
    const a = await loginAs(app, 'a@pat.test');
    const b = await loginAs(app, 'b@pat.test');
    const wsA = (await createWorkspace(a, 'Team A')).id;
    const wsB = (await createWorkspace(b, 'Team B')).id;
    const token = (
      await a.post('/auth/api-tokens').send({ name: 'A', workspaceId: wsA }).expect(201)
    ).body as ApiTokenWithSecret;
    await a.post('/auth/api-tokens').send({ name: 'X', workspaceId: wsB }).expect(404);
    expect((await b.get('/auth/api-tokens').expect(200)).body).toEqual([]);
    await b.delete(`/auth/api-tokens/${token.id}`).expect(404);
  });

  it('enforces workspace and scope on every request', async () => {
    const owner = await loginAs(app, 'scope@pat.test');
    const ws = (await createWorkspace(owner, 'Scoped')).id;
    const other = (await createWorkspace(owner, 'Other')).id;
    const readOnly = (
      await owner
        .post('/auth/api-tokens')
        .send({ name: 'reader', workspaceId: ws, scopes: ['read'] })
        .expect(201)
    ).body as ApiTokenWithSecret;
    expect(readOnly.scopes).toEqual(['read']);
    const as = (method: 'get' | 'post', url: string) =>
      request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${readOnly.token}`);
    await as('get', `/api/v1/workspaces/${ws}/monitors`).expect(200);
    await as('get', `/api/v1/workspaces/${other}/monitors`).expect(404);
    await as('post', `/api/v1/workspaces/${ws}/oncall/schedules`).send({}).expect(403);
  });
});
