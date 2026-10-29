import { createHmac, createSign, generateKeyPairSync, type JsonWebKey } from 'node:crypto';
import type {
  AwsSetupStart,
  OAuthCallbackResult,
  SetupPrResult,
  ToolView,
} from '@ape/api-contracts';
import type { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/core/db/client';
import { alerts, deployments } from '../src/core/db/schema';
import {
  GitHubAppClient,
  GitHubError,
  type GitHubPull,
} from '../src/connectors/github/infrastructure/github-app';
import { GitHubService } from '../src/connectors/github/github.service';
import { IngestionProcessor } from '../src/ingest/ingestion/application/ingestion.processor';
import { GITHUB_OIDC_ISSUER } from '../src/connectors/setup/infrastructure/github-oidc';
import { SetupSupport } from '../src/connectors/setup/application/setup-support.service';
import { ToolsService } from '../src/connectors/tools/tools.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

class FakeGitHub extends GitHubAppClient {
  permissions: Record<string, string> = {
    contents: 'write',
    pull_requests: 'write',
    workflows: 'write',
    metadata: 'read',
  };
  files: Record<string, string> = {
    'package.json': '{\n  "name": "shop",\n  "scripts": { "start": "node server.js" }\n}\n',
    'server.js': "require('express')",
  };
  blobs = new Map<string, string>();
  branches = new Map<string, string>();
  pulls: GitHubPull[] = [];
  trees = new Map<string, { path: string; sha: string }[]>();
  constructor() {
    super('1', 'unused');
  }
  override listInstallations() {
    return Promise.resolve([
      {
        id: 42,
        account: { login: 'acme', type: 'Organization' },
        repository_selection: 'selected' as const,
        permissions: this.permissions,
        suspended_at: null,
      },
    ]);
  }
  override app() {
    return Promise.resolve({ id: 1, slug: 'ape-test', name: 'ape-test', html_url: '' });
  }
  override getInstallation(id: number) {
    if (id !== 42) return Promise.reject(new GitHubError(404, 'Not Found'));
    return Promise.resolve({
      id,
      account: { login: 'acme', type: 'Organization' },
      repository_selection: 'selected' as const,
      permissions: this.permissions,
      suspended_at: null,
    });
  }
  override listRepositories() {
    return Promise.resolve([
      { id: 1, full_name: 'acme/shop', default_branch: 'main', private: true },
    ]);
  }
  override getRepo() {
    return Promise.resolve({ full_name: 'acme/shop', default_branch: 'main', private: true });
  }
  override getBranchSha(_i: number, _r: string, branch: string) {
    return Promise.resolve(branch === 'main' ? 'base000' : (this.branches.get(branch) ?? null));
  }
  override tree() {
    return Promise.resolve({ paths: Object.keys(this.files), truncated: false });
  }
  override fileContent(_i: number, _r: string, path: string) {
    return Promise.resolve(this.files[path]!);
  }
  override getCommit() {
    return Promise.resolve({ sha: 'base000', tree: { sha: 'tree000' } });
  }
  override createBlob(_i: number, _r: string, content: string) {
    const sha = `blob${this.blobs.size}`;
    this.blobs.set(sha, content);
    return Promise.resolve({ sha });
  }
  override createTree(_i: number, _r: string, _b: string, files: { path: string; sha: string }[]) {
    this.trees.set('t1', files);
    return Promise.resolve({ sha: 't1' });
  }
  override createCommit() {
    return Promise.resolve({ sha: 'c1' });
  }
  override createBranch(_i: number, _r: string, branch: string, sha: string) {
    this.branches.set(branch, sha);
    return Promise.resolve({ ref: branch });
  }
  override listPullsForBranch(_i: number, _r: string, branch: string) {
    return Promise.resolve(this.pulls.filter((p) => p.head.ref === branch));
  }
  override createPull(
    _i: number,
    _r: string,
    pr: { title: string; head: string; draft?: boolean },
  ) {
    const p = {
      id: 1,
      number: 7,
      html_url: 'https://github.com/acme/shop/pull/7',
      state: 'open',
      merged_at: null,
      merge_commit_sha: null,
      head: { ref: pr.head, sha: 'c1' },
      base: { ref: 'main' },
      title: pr.title,
    } as GitHubPull;
    this.pulls.push(p);
    return Promise.resolve(p);
  }

  committed(path: string) {
    const entry = this.trees.get('t1')?.find((f) => f.path === path);
    return entry ? this.blobs.get(entry.sha) : undefined;
  }
}

type Route = Record<string, unknown>;
const fakeFetch = (routes: Route) =>
  ((url: string, init: RequestInit = {}) => {
    const key = Object.keys(routes).find((k) => `${init.method ?? 'GET'} ${url}`.startsWith(k));
    const r = key ? routes[key] : undefined;
    const out =
      typeof r === 'function' ? (r as (u: string, i: RequestInit) => unknown)(url, init) : r;
    return Promise.resolve(new Response(JSON.stringify(out ?? {}), { status: key ? 200 : 404 }));
  }) as typeof fetch;

describe('One-click setup (e2e)', () => {
  let app: INestApplication<App>;
  let gh: FakeGitHub;
  let setup: SetupSupport;
  let tools: ToolsService;
  let owner: ReturnType<typeof request.agent>;
  let ws: string;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    setup = app.get(SetupSupport);
    tools = app.get(ToolsService);
  });
  beforeEach(async () => {
    await resetDatabase();
    gh = new FakeGitHub();
    app.get(GitHubService).useClient(gh);
    owner = await loginAs(app, 'owner@setup.test');
    ws = (await createWorkspace(owner, 'Setup')).id;
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  const connectGitHub = async () => {
    const { state } = (await owner.get(`/workspaces/${ws}/setup/github/state`).expect(200))
      .body as { state: string };
    await owner
      .post(`/workspaces/${ws}/setup/github/callback`)
      .send({ installationId: 42, state })
      .expect(200);
    return owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 });
  };

  it('GitHub: the install redirect connects with a state bound to this user and workspace', async () => {
    const { state } = (await owner.get(`/workspaces/${ws}/setup/github/state`).expect(200))
      .body as { state: string };
    const other = await loginAs(app, 'other@setup.test');
    const otherWs = (await createWorkspace(other, 'Other')).id;
    await other
      .post(`/workspaces/${otherWs}/setup/github/callback`)
      .send({ installationId: 42, state })
      .expect(400);

    const res = await owner
      .post(`/workspaces/${ws}/setup/github/callback`)
      .send({ installationId: 42, state })
      .expect(200);

    expect((res.body as OAuthCallbackResult).githubInstallationId).toBe(42);
    await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 }).expect(201);

    const again = await owner
      .post(`/workspaces/${ws}/setup/github/callback`)
      .send({ installationId: 42, state })
      .expect(200);
    expect((again.body as OAuthCallbackResult).done[0]).toMatch(/GitHub access updated/);
  });

  it('says where a GitHub installation is already connected, naming only your own workspaces', async () => {
    await connectGitHub();

    const ws2 = (await createWorkspace(owner, 'Second')).id;
    const mineElsewhere = (await owner.get(`/workspaces/${ws2}/github/app`).expect(200)).body as {
      connectedElsewhere: {
        id: number;
        workspaceName: string | null;
        workspaceId: string | null;
      }[];
    };
    expect(mineElsewhere.connectedElsewhere).toEqual([
      { id: 42, account: 'acme', workspaceId: ws, workspaceName: 'Setup' },
    ]);

    const stranger = await loginAs(app, 'stranger@setup.test');
    const ws3 = (await createWorkspace(stranger, 'Stranger')).id;
    const theirs = (await stranger.get(`/workspaces/${ws3}/github/app`).expect(200))
      .body as typeof mineElsewhere;
    expect(theirs.connectedElsewhere).toEqual([
      { id: 42, account: 'acme', workspaceId: null, workspaceName: null },
    ]);
  });

  it('opens a setup pull request that adds the agent, and reuses it on a second run', async () => {
    await connectGitHub().then((r) => expect(r.status).toBe(201));
    const body = { repository: 'acme/shop', kind: 'agent', service: 'shop-api' };
    const pr = (await owner.post(`/workspaces/${ws}/setup/pull-requests`).send(body).expect(201))
      .body as SetupPrResult;
    expect(pr).toMatchObject({ number: 7, language: 'node', existing: false, draft: false });
    expect(JSON.parse(gh.committed('package.json')!)).toMatchObject({
      dependencies: { '@ape/agent': '^0.1.0' },
      scripts: { start: 'node --require @ape/agent/register server.js' },
    });
    expect(gh.committed('.env.example')).toContain('APE_SERVICE=shop-api');
    const again = (await owner.post(`/workspaces/${ws}/setup/pull-requests`).send(body).expect(201))
      .body as SetupPrResult;
    expect(again.existing).toBe(true);

    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@setup.test', role: 'engineer' })
      .expect(201);
    const eng = await loginAs(app, 'eng@setup.test');
    await eng.post(`/workspaces/${ws}/setup/pull-requests`).send(body).expect(403);
  });

  it('explains a missing GitHub permission and an unreachable repo before touching GitHub', async () => {
    gh.permissions = { contents: 'write', pull_requests: 'write', metadata: 'read' };
    await connectGitHub();
    const deploy = await owner
      .post(`/workspaces/${ws}/setup/pull-requests`)
      .send({ repository: 'acme/shop', kind: 'deploy', service: 'shop-api' })
      .expect(403);
    expect((deploy.body as { message: string }).message).toMatch(/missing workflows: write/);
    const other = await owner
      .post(`/workspaces/${ws}/setup/pull-requests`)
      .send({ repository: 'acme/other', kind: 'agent', service: 'x' })
      .expect(400);
    expect((other.body as { message: string }).message).toMatch(
      /cannot see acme\/other.*settings\/installations\/42/,
    );
    const overview = (await owner.get(`/workspaces/${ws}/github/overview`).expect(200)).body as {
      installations: { repositories: string[]; manageUrl: string }[];
      missing: { deployWorkflow: string[]; setupPullRequest: string[] };
    };
    expect(overview.installations[0]).toMatchObject({
      repositories: ['acme/shop'],
      manageUrl: 'https://github.com/organizations/acme/settings/installations/42',
    });
    expect(overview.missing).toEqual({
      setupPullRequest: [],
      deployWorkflow: ['workflows: write'],
    });
    expect(gh.pulls).toHaveLength(0);
  });

  it('deploy markers authenticate with GitHub OIDC, no secret', async () => {
    await connectGitHub();
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    setup.jwks = () => Promise.resolve([{ ...publicKey.export({ format: 'jwk' }), kid: 'k' }]);
    const token = (repository: string) => {
      const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k' })).toString('base64url');
      const p = Buffer.from(
        JSON.stringify({
          iss: GITHUB_OIDC_ISSUER,
          aud: 'ape',
          exp: Math.floor(Date.now() / 1000) + 300,
          sub: 's',
          repository,
          run_id: '11',
        }),
      ).toString('base64url');
      return `${h}.${p}.${createSign('RSA-SHA256').update(`${h}.${p}`).sign(privateKey).toString('base64url')}`;
    };
    const marker = {
      service: 'shop-api',
      env: 'production',
      commit_sha: 'abc1234',
      version: 'main',
    };
    const http = request(app.getHttpServer());
    await http
      .post('/ingest/github-deploys')
      .set('Authorization', 'Bearer nope')
      .send(marker)
      .expect(401);
    await http
      .post('/ingest/github-deploys')
      .set('Authorization', `Bearer ${token('evil/repo')}`)
      .send(marker)
      .expect(403);
    await http
      .post('/ingest/github-deploys')
      .set('Authorization', `Bearer ${token('acme/shop')}`)
      .send(marker)
      .expect(202);

    await app.get(IngestionProcessor).processBatch();
    const rows = await db.select().from(deployments).where(eq(deployments.workspaceId, ws));
    expect(rows.map((r) => [r.serviceName, r.commitSha])).toEqual([['shop-api', 'abc1234']]);
  });

  it('Grafana: one token sets up alerts and read access', async () => {
    setup.fetchFn = fakeFetch({
      'GET https://g.example.com/api/v1/provisioning/contact-points': [],
      'POST https://g.example.com/api/v1/provisioning/contact-points': {},
      'GET https://g.example.com/api/v1/provisioning/policies': { receiver: 'default' },
      'PUT https://g.example.com/api/v1/provisioning/policies': {},
      'GET https://g.example.com/api/datasources': [{ uid: 'lk', name: 'Loki', type: 'loki' }],
    });
    tools.fetchFn = fakeFetch({
      'GET https://g.example.com/api/datasources/proxy/uid/lk/loki/api/v1/query_range': {
        data: { result: [] },
      },
    });
    const res = await owner
      .post(`/workspaces/${ws}/setup/tools`)
      .send({ tool: 'grafana', url: 'https://g.example.com', token: 'glsa_admin' })
      .expect(201);
    const view = (res.body as { tool: ToolView }).tool;
    expect(view.alerts.enabled).toBe(true);
    expect(view.reader.status).toBe('connected');
    expect(JSON.stringify(res.body)).not.toContain('glsa_admin');
  });

  it('AWS: one command, then a single-use callback stores read-only access', async () => {
    const start = (await owner.post(`/workspaces/${ws}/setup/aws`).expect(201))
      .body as AwsSetupStart;
    expect(start.command).toContain('aws cloudformation deploy');
    const callback = /CallbackUrl='http:\/\/localhost:4000(\/setup\/aws\/callback\/[^']+)'/.exec(
      start.command,
    )![1]!;
    expect(start.command).toMatch(
      /AlertUrl='http:\/\/localhost:4000\/ingest\/alerts\/[0-9a-f-]+\?token=ape_alert_/,
    );

    tools.fetchFn = fakeFetch({ 'POST https://logs.eu-west-1.amazonaws.com/': { events: [] } });
    const body = {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 's3cr3t',
      region: 'eu-west-1',
      logGroups: ['/ecs/shop'],
    };
    await request(app.getHttpServer()).post(callback).send(body).expect(204);
    await request(app.getHttpServer()).post(callback).send(body).expect(404);
    const list = (await owner.get(`/workspaces/${ws}/tools`).expect(200)).body as ToolView[];
    const cw = list.find((t) => t.id === 'cloudwatch')!;
    expect(cw.reader).toMatchObject({
      status: 'connected',
      settings: { region: 'eu-west-1', logGroups: '/ecs/shop' },
    });
    expect(cw.alerts.enabled).toBe(true);
  });

  it('Sentry: sign in and approve, then signed webhooks become alerts in that workspace', async () => {
    const { url } = (await owner.get(`/workspaces/${ws}/setup/oauth/sentry/start`).expect(200))
      .body as { url: string };
    const state = new URL(url).searchParams.get('state')!;
    expect(url).toContain('/sentry-apps/ape-test/external-install/');
    setup.fetchFn = fakeFetch({
      'POST https://sentry.io/api/0/sentry-app-installations/inst-1/authorizations/': {
        token: 'sat',
        refreshToken: 'srt',
        expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
      },
      'GET https://sentry.io/api/0/sentry-app-installations/inst-1/': {
        organization: { slug: 'acme' },
      },
      'PUT https://sentry.io/api/0/sentry-app-installations/inst-1/': {},
    });
    tools.fetchFn = fakeFetch({ 'GET https://sentry.io/api/0/organizations/acme/issues/': [] });
    const done = (
      await owner
        .post(`/workspaces/${ws}/setup/oauth/sentry/callback`)
        .send({ state, code: 'c', installationId: 'inst-1' })
        .expect(200)
    ).body as OAuthCallbackResult;
    expect(done.done[0]).toMatch(/acme/);

    const payload = JSON.stringify({
      action: 'triggered',
      installation: { uuid: 'inst-1' },
      data: {
        event: { title: 'TypeError: x', event_id: 'e1', level: 'error' },
        triggered_rule: 'Errors',
      },
    });
    const sig = createHmac('sha256', 'sentry-client-secret-not-real').update(payload).digest('hex');
    const http = request(app.getHttpServer());
    await http
      .post('/ingest/sentry-app')
      .set('Content-Type', 'application/json')
      .set('Sentry-Hook-Resource', 'event_alert')
      .set('Sentry-Hook-Signature', 'bad')
      .send(payload)
      .expect(401);
    await http
      .post('/ingest/sentry-app')
      .set('Content-Type', 'application/json')
      .set('Sentry-Hook-Resource', 'event_alert')
      .set('Sentry-Hook-Signature', sig)
      .set('Request-ID', 'r1')
      .send(payload)
      .expect(202);
    await app.get(IngestionProcessor).processBatch();
    const rows = await db.select().from(alerts).where(eq(alerts.workspaceId, ws));
    expect(rows.map((a) => a.title)).toEqual(['TypeError: x']);
  });

  it('Vercel with a token creates a drain using a fresh ingest token', async () => {
    let sent: { delivery?: { headers?: Record<string, string> } } = {};
    setup.fetchFn = fakeFetch({
      'POST https://api.vercel.com/v1/drains': (_u: string, i: RequestInit) => (
        (sent = JSON.parse(i.body as string) as typeof sent),
        {}
      ),
    });
    const res = await owner
      .post(`/workspaces/${ws}/setup/drains/vercel`)
      .send({ accessToken: 'vt' })
      .expect(201);
    expect((res.body as { done: string[] }).done[0]).toMatch(/log drain/);
    const auth = sent.delivery!.headers!.Authorization!;
    await request(app.getHttpServer())
      .post('/v1/drain')
      .set('Authorization', auth)
      .send([{ id: 'x', message: 'hi', timestamp: Date.now(), projectName: 'web' }])
      .expect(200);
  });

  it('serves the agent installer and manifests without secrets', async () => {
    const http = request(app.getHttpServer());
    const sh = await http.get('/install/agent.sh').expect(200);
    expect(sh.text).toContain('APE_ENDPOINT="${APE_ENDPOINT:-http://localhost:4000}"');
    const k8s = await http.get('/install/kubernetes.yaml?service=shop').expect(200);
    expect(k8s.text).toContain('service=shop');
    await http.get('/setup/aws/template.yaml').expect(200);
    const caps = (await owner.get(`/workspaces/${ws}/setup/capabilities`).expect(200)).body as {
      oauth: Record<string, boolean>;
    };
    expect(caps.oauth).toEqual({ sentry: true, vercel: false, heroku: false });
  });
});
