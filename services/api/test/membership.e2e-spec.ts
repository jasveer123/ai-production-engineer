import type { Me } from '@ape/api-contracts';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Members, invitations and sessions (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(resetDatabase);
  afterAll(() => app.close());

  it('turns an invitation into a membership on login, audited', async () => {
    const owner = await loginAs(app, 'owner@x.test');
    const ws = await createWorkspace(owner, 'Team X');
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'Eng@X.test', role: 'engineer' })
      .expect(201);

    const eng = await loginAs(app, 'eng@x.test');
    const me = await eng.get('/auth/me').expect(200);
    expect((me.body as Me).workspaces).toEqual([{ id: ws.id, name: 'Team X', role: 'engineer' }]);

    const audit = await owner.get(`/workspaces/${ws.id}/audit-events`).expect(200);
    const actions = (audit.body as { action: string }[]).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['workspace.created', 'invitation.created', 'invitation.accepted']),
    );
  });

  it('revokes access immediately when a member is removed', async () => {
    const owner = await loginAs(app, 'owner@x.test');
    const ws = await createWorkspace(owner, 'Team X');
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'eng@x.test', role: 'engineer' })
      .expect(201);
    const eng = await loginAs(app, 'eng@x.test');
    await eng.get(`/workspaces/${ws.id}/services`).expect(200);

    const members = await owner.get(`/workspaces/${ws.id}/members`).expect(200);
    const engMember = (members.body as { id: string; email: string }[]).find(
      (m) => m.email === 'eng@x.test',
    )!;
    await owner.delete(`/workspaces/${ws.id}/members/${engMember.id}`).expect(204);

    await eng.get(`/workspaces/${ws.id}/services`).expect(404);
  });

  it('keeps at least one owner and stops admins from managing owners', async () => {
    const owner = await loginAs(app, 'owner@x.test');
    const ws = await createWorkspace(owner, 'Team X');
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'admin@x.test', role: 'admin' })
      .expect(201);
    const admin = await loginAs(app, 'admin@x.test');
    await admin.get('/auth/me').expect(200);

    const members = (await owner.get(`/workspaces/${ws.id}/members`)).body as {
      id: string;
      role: string;
    }[];
    const ownerMember = members.find((m) => m.role === 'owner')!;

    await owner
      .patch(`/workspaces/${ws.id}/members/${ownerMember.id}`)
      .send({ role: 'admin' })
      .expect(409);
    await admin
      .patch(`/workspaces/${ws.id}/members/${ownerMember.id}`)
      .send({ role: 'viewer' })
      .expect(403);
    await admin
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'boss@x.test', role: 'owner' })
      .expect(403);
  });

  it('rejects the session after logout', async () => {
    const user = await loginAs(app, 'someone@x.test');
    await user.get('/auth/me').expect(200);
    await user.post('/auth/logout').expect(204);
    await user.get('/auth/me').expect(401);
  });

  it('returns 409 for a duplicate service name and environment', async () => {
    const owner = await loginAs(app, 'owner@x.test');
    const ws = await createWorkspace(owner, 'Team X');
    const body = { name: 'api', environment: 'prod', repositoryFullName: 'me/api' };
    await owner.post(`/workspaces/${ws.id}/services`).send(body).expect(201);
    await owner.post(`/workspaces/${ws.id}/services`).send(body).expect(409);
  });
});
