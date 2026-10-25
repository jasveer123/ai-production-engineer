import type { INestApplication } from '@nestjs/common';
import type { GitHubAppInfo, Integration, RepoCommit, RepositoryAccess } from '@ape/api-contracts';
import { eq } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/db/client';
import { auditEvents, integrations } from '../src/db/schema';
import { GitHubAppClient, GitHubError, type GitHubInstallation } from '../src/github/github-app';
import { GitHubService } from '../src/github/github.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

/** In-memory stand-in for GitHub. `uninstalled` simulates the App being removed. */
class FakeGitHub extends GitHubAppClient {
  uninstalled = new Set<number>();
  constructor() {
    super('1', 'unused');
  }
  override app() {
    return Promise.resolve({ id: 1, slug: 'ape-test', name: 'ape-test', html_url: '' });
  }
  override listInstallations(): Promise<GitHubInstallation[]> {
    return Promise.resolve(
      [42, 43]
        .filter((id) => !this.uninstalled.has(id))
        .map((id) => ({
          id,
          account: { login: `acct${id}`, type: 'User' },
          repository_selection: 'selected',
          permissions: {},
          suspended_at: null,
        })),
    );
  }
  override async getInstallation(id: number) {
    if (this.uninstalled.has(id) || ![42, 43].includes(id)) throw new GitHubError(404, 'Not Found');
    return (await this.listInstallations()).find((i) => i.id === id)!;
  }
  override listRepositories(id: number) {
    return Promise.resolve([
      { id: 1, full_name: `acct${id}/demo-shop`, default_branch: 'main', private: true },
    ]);
  }
  override listCommits() {
    return Promise.resolve([
      {
        sha: 'abc1234def',
        html_url: 'https://github.com/x/commit/abc',
        commit: {
          message: 'feat: v2 pricing\n\nbody',
          author: { name: 'Dev', date: '2026-10-18T00:00:00Z' },
        },
      },
    ]);
  }
}

describe('GitHub App integration (e2e)', () => {
  let app: INestApplication<App>;
  let github: GitHubService;
  let fake: FakeGitHub;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    github = app.get(GitHubService);
  });
  beforeEach(async () => {
    await resetDatabase();
    fake = new FakeGitHub();
    github.useClient(fake);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function setup() {
    const owner = await loginAs(app, 'owner@gh.test');
    const ws = (await createWorkspace(owner, 'GH')).id;
    return { owner, ws };
  }

  it('connects an installation, lists accessible repos and reads commits', async () => {
    const { owner, ws } = await setup();
    const info = (await owner.get(`/workspaces/${ws}/github/app`).expect(200))
      .body as GitHubAppInfo;
    expect(info.installUrl).toBe('https://github.com/apps/ape-test/installations/new');
    expect(info.installations.map((i) => i.id)).toEqual([42, 43]);

    const integration = (
      await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 }).expect(201)
    ).body as Integration;
    expect(integration).toMatchObject({ provider: 'github', status: 'connected' });
    expect(integration.scope).toContain('acct42/demo-shop');

    // Claimed installations are no longer offered. Connecting one again in the same workspace
    // updates it (the "Manage repositories" page relies on this) and never makes a second row.
    const after = (await owner.get(`/workspaces/${ws}/github/app`).expect(200))
      .body as GitHubAppInfo;
    expect(after.installations.map((i) => i.id)).toEqual([43]);
    const again = (
      await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 }).expect(201)
    ).body as Integration;
    expect(again.id).toBe(integration.id);

    const svc = await owner
      .post(`/workspaces/${ws}/services`)
      .send({ name: 'api', environment: 'production', repositoryFullName: 'acct42/demo-shop' })
      .expect(201);
    await owner
      .post(`/workspaces/${ws}/services`)
      .send({ name: 'other', environment: 'production', repositoryFullName: 'someone/else' })
      .expect(201);
    const access = (await owner.get(`/workspaces/${ws}/github/repository-access`).expect(200))
      .body as RepositoryAccess[];
    expect(access).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ repositoryFullName: 'acct42/demo-shop', accessible: true }),
        expect.objectContaining({ repositoryFullName: 'someone/else', accessible: false }),
      ]),
    );
    const commits = (
      await owner
        .get(`/workspaces/${ws}/services/${(svc.body as { id: string }).id}/commits`)
        .expect(200)
    ).body as RepoCommit[];
    expect(commits[0]).toMatchObject({
      sha: 'abc1234def',
      message: 'feat: v2 pricing',
      author: 'Dev',
    });
  });

  it('rejects unknown installations', async () => {
    const { owner, ws } = await setup();
    await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 999 }).expect(404);
  });

  it('marks the integration disconnected and stops repo access when the App is uninstalled', async () => {
    const { owner, ws } = await setup();
    const integration = (
      await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 }).expect(201)
    ).body as Integration;
    const svc = await owner
      .post(`/workspaces/${ws}/services`)
      .send({ name: 'api', environment: 'production', repositoryFullName: 'acct42/demo-shop' })
      .expect(201);

    fake.uninstalled.add(42);
    await github.checkAll();

    const [row] = await db.select().from(integrations).where(eq(integrations.id, integration.id));
    expect(row!.status).toBe('disconnected');
    expect(row!.lastError).toContain('uninstalled');
    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'integration.revoked'));
    expect(audit).toHaveLength(1);

    const res = await owner
      .get(`/workspaces/${ws}/services/${(svc.body as { id: string }).id}/commits`)
      .expect(409);
    expect((res.body as { code: string }).code).toBe('repository_not_accessible');
  });
});
