import type { InvitationWithLink, Me } from '@ape/api-contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Mailer } from '../src/modules/auth/infrastructure/mailer.service';
import { createTestApp, loginAs, resetDatabase } from './helpers';

const PASSWORD = 'tidy-otter-lamp-42';
const linkToken = (text: string) => /token=([A-Za-z0-9_-]+)/.exec(text)![1]!;

describe('Accounts: register, sign in, reset, invitations (e2e)', () => {
  let app: INestApplication<App>;
  let mailer: Mailer;

  beforeAll(async () => {
    app = await createTestApp();
    mailer = app.get(Mailer);
  });
  beforeEach(async () => {
    await resetDatabase();
    mailer.sent.length = 0;
  });
  afterAll(() => app.close());

  const register = (agent: ReturnType<typeof request.agent>, email: string, extra: object = {}) =>
    agent.post('/auth/register').send({ name: 'Asha', email, password: PASSWORD, ...extra });

  const confirmEmail = (agent: ReturnType<typeof request.agent>) =>
    agent.post('/auth/verify-email').send({ token: linkToken(mailer.sent.at(-1)!.text) });

  const signUpVerified = async (
    agent: ReturnType<typeof request.agent>,
    email: string,
    extra: object = {},
  ) => {
    await register(agent, email, extra).expect(202);
    return confirmEmail(agent).expect(200);
  };

  it('sign-up only sends a link; the link signs you in once', async () => {
    const a = request.agent(app.getHttpServer());
    const signUp = await register(a, 'asha@shop.test', { workspaceName: 'Shop' }).expect(202);
    expect(signUp.headers['set-cookie']).toBeUndefined();
    await a.get('/auth/me').expect(401);
    expect(mailer.sent.at(-1)!.subject).toBe('Confirm your email');

    const early = await a
      .post('/auth/login')
      .send({ email: 'asha@shop.test', password: PASSWORD })
      .expect(403);
    expect((early.body as { code: string }).code).toBe('email_not_verified');
    await a.get('/auth/me').expect(401);

    const token = linkToken(mailer.sent.at(-1)!.text);
    const verified = await a.post('/auth/verify-email').send({ token }).expect(200);
    const me = verified.body as Me;
    expect(me.user).toMatchObject({ email: 'asha@shop.test', emailVerified: true });
    expect(me.workspaces).toMatchObject([{ name: 'Shop', role: 'owner' }]);
    await a.get('/auth/me').expect(200);

    await request(app.getHttpServer()).post('/auth/verify-email').send({ token }).expect(400);
    await a.post('/auth/logout').expect(204);
    await a.post('/auth/login').send({ email: 'asha@shop.test', password: PASSWORD }).expect(200);
  });

  it('resends the link to unverified accounts only, and never reveals which emails exist', async () => {
    const http = request(app.getHttpServer());
    await register(request.agent(app.getHttpServer()), 'asha@shop.test').expect(202);
    mailer.sent.length = 0;

    await http.post('/auth/resend-verification').send({ email: 'asha@shop.test' }).expect(204);
    expect(mailer.sent).toHaveLength(1);
    await http.post('/auth/resend-verification').send({ email: 'nobody@shop.test' }).expect(204);
    expect(mailer.sent).toHaveLength(1);

    await confirmEmail(request.agent(app.getHttpServer())).expect(200);
    await http.post('/auth/resend-verification').send({ email: 'asha@shop.test' }).expect(204);
    expect(mailer.sent).toHaveLength(1);
  });

  it('registers, signs in, creates a workspace as owner, and signs out', async () => {
    const a = request.agent(app.getHttpServer());
    const res = await signUpVerified(a, 'Asha@Shop.test');
    const me = res.body as Me;
    expect(me.user).toMatchObject({
      email: 'asha@shop.test',
      emailVerified: true,
      hasPassword: true,
    });
    expect(me.workspaces).toEqual([]);

    const ws = await a.post('/workspaces').send({ name: 'Shop' }).expect(201);
    expect((ws.body as { role: string }).role).toBe('owner');

    await a.post('/auth/logout').expect(204);
    await a.get('/auth/me').expect(401);

    const b = request.agent(app.getHttpServer());
    const login = await b
      .post('/auth/login')
      .send({ email: 'asha@shop.test', password: PASSWORD })
      .expect(200);
    expect((login.body as Me).workspaces).toHaveLength(1);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await register(request.agent(app.getHttpServer()), 'a@shop.test').expect(202);
    const dup = await register(request.agent(app.getHttpServer()), 'A@shop.test').expect(409);
    expect((dup.body as { code: string }).code).toBe('email_taken');
    const weak = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'B', email: 'b@shop.test', password: 'password123' })
      .expect(400);
    expect((weak.body as { code: string }).code).toBe('weak_password');
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'B', email: 'b@shop.test', password: 'short' })
      .expect(400);
  });

  it('gives the same answer for unknown email and wrong password, then locks after 5 failures', async () => {
    await register(request.agent(app.getHttpServer()), 'a@shop.test').expect(202);
    const http = request(app.getHttpServer());
    const unknown = await http
      .post('/auth/login')
      .send({ email: 'nobody@shop.test', password: 'x' })
      .expect(401);
    const wrong = await http
      .post('/auth/login')
      .send({ email: 'a@shop.test', password: 'x' })
      .expect(401);
    expect((unknown.body as { message: string }).message).toBe(
      (wrong.body as { message: string }).message,
    );

    for (let i = 0; i < 4; i++)
      await http.post('/auth/login').send({ email: 'a@shop.test', password: 'x' }).expect(401);
    const locked = await http
      .post('/auth/login')
      .send({ email: 'a@shop.test', password: PASSWORD })
      .expect(401);
    expect((locked.body as { code: string }).code).toBe('account_locked');
  });

  it('resets the password with a single-use link and signs out other sessions', async () => {
    const old = request.agent(app.getHttpServer());
    await signUpVerified(old, 'a@shop.test');
    const http = request(app.getHttpServer());
    await http.post('/auth/forgot-password').send({ email: 'nobody@shop.test' }).expect(204);
    expect(mailer.sent.filter((m) => m.subject === 'Reset your password')).toHaveLength(0);

    await http.post('/auth/forgot-password').send({ email: 'a@shop.test' }).expect(204);
    const token = linkToken(mailer.sent.at(-1)!.text);
    const fresh = request.agent(app.getHttpServer());
    const reset = await fresh
      .post('/auth/reset-password')
      .send({ token, password: 'new-quiet-harbor-7' })
      .expect(200);
    expect((reset.body as Me).user.emailVerified).toBe(true);

    await old.get('/auth/me').expect(401);
    await fresh.get('/auth/me').expect(200);
    await http
      .post('/auth/reset-password')
      .send({ token, password: 'another-calm-river-9' })
      .expect(400);
    await http
      .post('/auth/login')
      .send({ email: 'a@shop.test', password: 'new-quiet-harbor-7' })
      .expect(200);
  });

  describe('refresh and social sign-in', () => {
    const cookieValue = (res: request.Response, name: string) => {
      const header = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(`${name}=`),
      )!;
      return header.split(';')[0]!.slice(name.length + 1);
    };

    it('issues a refresh cookie and renews the session without a password', async () => {
      const a = request.agent(app.getHttpServer());
      const res = await signUpVerified(a, 'a@shop.test');
      const refresh = cookieValue(res, 'ape_refresh');
      expect(refresh.length).toBeGreaterThan(20);

      const fresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `ape_refresh=${refresh}`)
        .expect(200);
      expect((fresh.body as Me).user.email).toBe('a@shop.test');
      const access = cookieValue(fresh, 'ape_session');
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `ape_session=${access}`)
        .expect(200);
    });

    it('does not accept a refresh token as an access token, or the reverse', async () => {
      const res = await signUpVerified(request.agent(app.getHttpServer()), 'a@shop.test');
      const refresh = cookieValue(res, 'ape_refresh');
      const access = cookieValue(res, 'ape_session');
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `ape_session=${refresh}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `ape_refresh=${access}`)
        .expect(401);
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('stops refreshing once the session is signed out', async () => {
      const a = request.agent(app.getHttpServer());
      const res = await signUpVerified(a, 'a@shop.test');
      const refresh = cookieValue(res, 'ape_refresh');
      await a.post('/auth/logout').expect(204);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `ape_refresh=${refresh}`)
        .expect(401);
    });

    it('lists the sign-in providers and hides Slack until it is configured', async () => {
      const res = await request(app.getHttpServer()).get('/auth/providers').expect(200);
      expect(res.body).toMatchObject({ password: true, slack: false });
      await request(app.getHttpServer()).get('/auth/slack').expect(404);
    });
  });

  it('changes password with the current one and ends other sessions', async () => {
    const a = request.agent(app.getHttpServer());
    await signUpVerified(a, 'a@shop.test');
    const other = request.agent(app.getHttpServer());
    await other.post('/auth/login').send({ email: 'a@shop.test', password: PASSWORD }).expect(200);
    await a
      .post('/auth/change-password')
      .send({ currentPassword: 'wrong', newPassword: 'fresh-maple-door-3' })
      .expect(400);
    await a
      .post('/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'fresh-maple-door-3' })
      .expect(204);
    await a.get('/auth/me').expect(200);
    await other.get('/auth/me').expect(401);
  });

  it('invite link: admin invites, invitee registers through it and joins with the role', async () => {
    const owner = await loginAs(app, 'owner@shop.test');
    const ws = (await owner.post('/workspaces').send({ name: 'Shop' }).expect(201)).body as {
      id: string;
    };
    const inv = (
      await owner
        .post(`/workspaces/${ws.id}/invitations`)
        .send({ email: 'eng@shop.test', role: 'engineer' })
        .expect(201)
    ).body as InvitationWithLink;
    expect(inv.inviteUrl).toMatch(/\/invite\/\?token=/);
    const token = linkToken(inv.inviteUrl);

    const preview = await request(app.getHttpServer())
      .get(`/auth/invitations/${token}`)
      .expect(200);
    expect(preview.body).toMatchObject({
      email: 'eng@shop.test',
      role: 'engineer',
      workspaceName: 'Shop',
      accountExists: false,
    });

    const eng = request.agent(app.getHttpServer());
    await register(eng, 'other@shop.test', { inviteToken: token }).expect(400);
    const res = await register(eng, 'eng@shop.test', { inviteToken: token }).expect(201);
    expect((res.body as Me).user.emailVerified).toBe(true);
    expect((res.body as Me).workspaces).toEqual([{ id: ws.id, name: 'Shop', role: 'engineer' }]);
    await request(app.getHttpServer()).get(`/auth/invitations/${token}`).expect(400);
  });

  it('does not hand invitations to an unverified account that claims the email', async () => {
    const owner = await loginAs(app, 'owner@shop.test');
    const ws = (await owner.post('/workspaces').send({ name: 'Shop' }).expect(201)).body as {
      id: string;
    };
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'victim@shop.test', role: 'admin' })
      .expect(201);
    const attacker = request.agent(app.getHttpServer());
    await register(attacker, 'victim@shop.test').expect(202);
    await attacker.get(`/workspaces/${ws.id}/members`).expect(401);
    await attacker
      .post('/auth/login')
      .send({ email: 'victim@shop.test', password: PASSWORD })
      .expect(403);

    await loginAs(app, 'victim@shop.test');
    await attacker.get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'victim@shop.test', password: PASSWORD })
      .expect(401);
  });

  it('admins assign roles below owner; only owners grant owner', async () => {
    const owner = await loginAs(app, 'owner@shop.test');
    const ws = (await owner.post('/workspaces').send({ name: 'Shop' }).expect(201)).body as {
      id: string;
    };
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'admin@shop.test', role: 'admin' })
      .expect(201);
    await owner
      .post(`/workspaces/${ws.id}/invitations`)
      .send({ email: 'v@shop.test', role: 'viewer' })
      .expect(201);
    const admin = await loginAs(app, 'admin@shop.test');
    const viewer = await loginAs(app, 'v@shop.test');
    const members = (await admin.get(`/workspaces/${ws.id}/members`).expect(200)).body as {
      id: string;
      email: string;
    }[];
    const v = members.find((m) => m.email === 'v@shop.test')!;

    await viewer
      .patch(`/workspaces/${ws.id}/members/${v.id}`)
      .send({ role: 'engineer' })
      .expect(403);
    await admin
      .patch(`/workspaces/${ws.id}/members/${v.id}`)
      .send({ role: 'engineer' })
      .expect(200);
    await admin.patch(`/workspaces/${ws.id}/members/${v.id}`).send({ role: 'owner' }).expect(403);
    await owner.patch(`/workspaces/${ws.id}/members/${v.id}`).send({ role: 'owner' }).expect(200);
  });
});
