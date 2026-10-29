import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { IncidentFixes, PullRequestView } from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { ArtifactStore } from '../src/core/artifacts/artifact-store.service';
import { createDatabase } from '../src/core/db/client';
import {
  approvals,
  auditEvents,
  fixProposals,
  incidents,
  investigations,
  pullRequests,
  workspaceMembers,
  workspaces,
} from '../src/core/db/schema';
import {
  GitHubAppClient,
  GitHubError,
  type GitHubInstallation,
  type GitHubPull,
} from '../src/connectors/github/infrastructure/github-app';
import { GitHubService } from '../src/connectors/github/github.service';
import { PrActivitiesService } from '../src/modules/pulls/activities/pr-activities.service';
import { PullSyncService } from '../src/modules/pulls/application/pull-sync.service';
import { TemporalService } from '../src/core/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const REPO = 'acct42/demo-shop';
const WRITE = { contents: 'write', pull_requests: 'write', metadata: 'read' };

class FakeGitHub extends GitHubAppClient {
  permissions: Record<string, string> = { ...WRITE };
  uninstalled = false;
  branches = new Map<string, string>();
  pulls: GitHubPull[] = [];
  calls: string[] = [];
  dropNext = new Set<string>();
  checks: { name: string; status: string; conclusion: string | null }[] = [];
  private n = 0;
  constructor() {
    super('1', 'unused');
  }

  private lose<T>(name: string, value: T): Promise<T> {
    this.calls.push(name);
    if (this.dropNext.delete(name)) return Promise.reject(new Error(`socket hang up (${name})`));
    return Promise.resolve(value);
  }
  override getInstallation(id: number): Promise<GitHubInstallation> {
    if (this.uninstalled) return Promise.reject(new GitHubError(404, 'Not Found'));
    return Promise.resolve({
      id,
      account: { login: 'acct42', type: 'User' },
      repository_selection: 'selected',
      permissions: this.permissions,
      suspended_at: null,
    });
  }
  override async listInstallations() {
    return [await this.getInstallation(42)];
  }
  override listRepositories() {
    return Promise.resolve([{ id: 1, full_name: REPO, default_branch: 'main', private: true }]);
  }
  override getCommit(_i: number, _r: string, sha: string) {
    return Promise.resolve({ sha, tree: { sha: `tree-${sha}` } });
  }
  override createBlob() {
    this.calls.push('blob');
    return Promise.resolve({ sha: `blob-${++this.n}` });
  }
  override createTree() {
    this.calls.push('tree');
    return Promise.resolve({ sha: `tree-${++this.n}` });
  }
  override createCommit() {
    this.calls.push('commit');
    return Promise.resolve({ sha: `commit-${++this.n}` });
  }
  override getBranchSha(_i: number, _r: string, branch: string) {
    return Promise.resolve(this.branches.get(branch) ?? null);
  }
  override createBranch(_i: number, _r: string, branch: string, sha: string) {
    if (this.branches.has(branch))
      return Promise.reject(new GitHubError(422, 'Reference already exists'));
    this.branches.set(branch, sha);
    return this.lose('branch', { ref: `refs/heads/${branch}` });
  }
  override listPullsForBranch(_i: number, _r: string, branch: string) {
    return Promise.resolve(this.pulls.filter((p) => p.head.ref === branch));
  }
  override createPull(_i: number, _r: string, pr: { title: string; head: string; base: string }) {
    if (pr.base === pr.head) return Promise.reject(new Error('head equals base'));
    const created: GitHubPull = {
      id: 1000 + this.pulls.length,
      number: 7 + this.pulls.length,
      html_url: `https://github.com/${REPO}/pull/${7 + this.pulls.length}`,
      state: 'open',
      merged: false,
      merged_at: null,
      merge_commit_sha: null,
      head: { ref: pr.head, sha: this.branches.get(pr.head) ?? 'x' },
      base: { ref: pr.base },
      title: pr.title,
    };
    this.pulls.push(created);
    return this.lose('pull', created);
  }
  override getPull(_i: number, _r: string, number: number) {
    const p = this.pulls.find((x) => x.number === number);
    return p ? Promise.resolve(p) : Promise.reject(new GitHubError(404, 'Not Found'));
  }
  override checkRuns() {
    return Promise.resolve(this.checks);
  }
}

describe('Approval gate and pull requests (e2e)', () => {
  let app: INestApplication<App>;
  let fake: FakeGitHub;
  let prs: PrActivitiesService;
  let sync: PullSyncService;
  const signals: { incidentId: string; status: string }[] = [];
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    prs = app.get(PrActivitiesService);
    sync = app.get(PullSyncService);
    const temporal = app.get(TemporalService);
    jest.spyOn(temporal, 'state').mockResolvedValue({ phase: 'awaiting_fix_decision' } as never);
    jest.spyOn(temporal, 'fixDecision').mockResolvedValue();
    jest.spyOn(temporal, 'pullRequestStatus').mockImplementation((incidentId, s) => {
      signals.push({ incidentId, status: s.status });
      return Promise.resolve();
    });
    jest
      .spyOn(app.get(ArtifactStore), 'getJson')
      .mockResolvedValue({ files: { 'src/a.ts': 'fixed', 'test/ape-regression.test.ts': 't' } });
  });
  beforeEach(async () => {
    await resetDatabase();
    fake = new FakeGitHub();
    app.get(GitHubService).useClient(fake);
    signals.length = 0;
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function setup() {
    const owner = await loginAs(app, 'owner@pr.test');
    const ws = (await createWorkspace(owner, 'PR')).id;
    await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 42 }).expect(201);
    const svc = (
      await owner
        .post(`/workspaces/${ws}/services`)
        .send({ name: 'shop', environment: 'production', repositoryFullName: REPO })
        .expect(201)
    ).body as { id: string };
    const now = new Date();
    const [inc] = await db
      .insert(incidents)
      .values({
        workspaceId: ws,
        serviceId: svc.id,
        title: 'Checkout fails without a coupon',
        fingerprint: 'fp',
        status: 'awaiting_review',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning();
    const [inv] = await db
      .insert(investigations)
      .values({ workspaceId: ws, incidentId: inc!.id, workflowId: 'wf', status: 'completed' })
      .returning();
    const [fix] = await db
      .insert(fixProposals)
      .values({
        workspaceId: ws,
        incidentId: inc!.id,
        investigationId: inv!.id,
        repositoryFullName: REPO,
        baseCommitSha: 'base123',
        status: 'validated',
        patchHash: 'hash-1',
        patchAttempts: 1,
      })
      .returning();
    const input = { workspaceId: ws, incidentId: inc!.id, fixProposalId: fix!.id };
    return { owner, ws, incidentId: inc!.id, fixId: fix!.id, input };
  }

  async function approve(
    agent: Awaited<ReturnType<typeof loginAs>>,
    ws: string,
    incidentId: string,
  ) {
    await agent
      .post(`/workspaces/${ws}/incidents/${incidentId}/fixes/actions`)
      .send({ action: 'approve_pr' })
      .expect(200);
    const [a] = await db.select().from(approvals).where(eq(approvals.workspaceId, ws));
    return a!;
  }

  it('records the approval with patch hash, policy version and role', async () => {
    const { owner, ws, incidentId, fixId } = await setup();
    const a = await approve(owner, ws, incidentId);
    expect(a).toMatchObject({
      resourceType: 'pull_request',
      resourceId: fixId,
      decision: 'approved',
      artifactHash: 'hash-1',
      policyVersion: 'pr-approval-v1',
      actorRole: 'owner',
    });
  });

  it('opens exactly one PR even when GitHub responses are lost and the activity retries', async () => {
    const { owner, ws, incidentId, input } = await setup();
    const a = await approve(owner, ws, incidentId);
    fake.dropNext.add('branch');
    await expect(prs.createPullRequest({ ...input, approvalId: a.id })).rejects.toThrow(/hang up/);
    fake.dropNext.add('pull');
    await expect(prs.createPullRequest({ ...input, approvalId: a.id })).rejects.toThrow(/hang up/);
    const third = await prs.createPullRequest({ ...input, approvalId: a.id });
    const fourth = await prs.createPullRequest({ ...input, approvalId: a.id });

    expect(third).toMatchObject({ status: 'existing', number: 7 });
    expect(fourth).toMatchObject({ status: 'existing', number: 7 });
    expect(fake.pulls).toHaveLength(1);
    expect(fake.calls.filter((c) => c === 'commit')).toHaveLength(1);
    const branch = `ai-fix/incident-${incidentId.slice(0, 8)}-v1`;
    expect([...fake.branches.keys()]).toEqual([branch]);
    expect(fake.pulls[0]).toMatchObject({ base: { ref: 'main' }, head: { ref: branch } });
    const rows = await db.select().from(pullRequests).where(eq(pullRequests.workspaceId, ws));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ number: 7, status: 'open', approvalId: a.id });

    const fixes = (await owner.get(`/workspaces/${ws}/incidents/${incidentId}/fixes`).expect(200))
      .body as IncidentFixes;
    expect(fixes.pullRequest).toMatchObject({ number: 7, approvedBy: 'owner@pr.test' });
  });

  it('a viewer cannot approve, and the workspace policy minimum role is enforced', async () => {
    const { owner, ws, incidentId } = await setup();
    for (const [email, role] of [
      ['viewer@pr.test', 'viewer'],
      ['eng@pr.test', 'engineer'],
    ] as const) {
      await owner.post(`/workspaces/${ws}/invitations`).send({ email, role }).expect(201);
    }
    const viewer = await loginAs(app, 'viewer@pr.test');
    await viewer
      .post(`/workspaces/${ws}/incidents/${incidentId}/fixes/actions`)
      .send({ action: 'approve_pr' })
      .expect(403);

    await db
      .update(workspaces)
      .set({ settings: { approvalPolicy: { prMinRole: 'admin' } } })
      .where(eq(workspaces.id, ws));
    const eng = await loginAs(app, 'eng@pr.test');
    const res = await eng
      .post(`/workspaces/${ws}/incidents/${incidentId}/fixes/actions`)
      .send({ action: 'approve_pr' })
      .expect(403);
    expect((res.body as { code: string }).code).toBe('approval_policy');
    expect(await db.select().from(approvals).where(eq(approvals.workspaceId, ws))).toHaveLength(0);
  });

  it('blocks the write when the approver was demoted after approving', async () => {
    const { owner, ws, incidentId, input } = await setup();
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@pr.test', role: 'engineer' });
    const eng = await loginAs(app, 'eng@pr.test');
    const a = await approve(eng, ws, incidentId);
    await db
      .update(workspaceMembers)
      .set({ role: 'viewer' })
      .where(and(eq(workspaceMembers.workspaceId, ws), eq(workspaceMembers.userId, a.actorId)));
    const out = await prs.createPullRequest({ ...input, approvalId: a.id });
    expect(out).toMatchObject({ status: 'blocked' });
    expect((out as { reason: string }).reason).toMatch(/no longer meets/);
    expect(fake.pulls).toHaveLength(0);
    const denied = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.workspaceId, ws), eq(auditEvents.action, 'pull_request.create')));
    expect(denied[0]?.outcome).toBe('denied');
  });

  it('blocks the write when the patch changed after approval', async () => {
    const { owner, ws, incidentId, fixId, input } = await setup();
    const a = await approve(owner, ws, incidentId);
    await db.update(fixProposals).set({ patchHash: 'hash-2' }).where(eq(fixProposals.id, fixId));
    const out = await prs.createPullRequest({ ...input, approvalId: a.id });
    expect(out).toEqual({ status: 'blocked', reason: 'The patch changed after it was approved' });
    expect(fake.calls).toHaveLength(0);
  });

  it('blocks the write when the installation was revoked or lost write access', async () => {
    const { owner, ws, incidentId, input } = await setup();
    const a = await approve(owner, ws, incidentId);
    fake.permissions = { contents: 'read', pull_requests: 'write' };
    expect(await prs.createPullRequest({ ...input, approvalId: a.id })).toMatchObject({
      status: 'blocked',
      reason: 'The GitHub App lacks contents:write',
    });
    fake.permissions = { ...WRITE };
    fake.uninstalled = true;
    expect(await prs.createPullRequest({ ...input, approvalId: a.id })).toMatchObject({
      status: 'blocked',
      reason: 'The GitHub App was uninstalled',
    });
    expect(fake.pulls).toHaveLength(0);
  });

  it('syncs checks and signals the workflow once when the PR is merged', async () => {
    const { owner, ws, incidentId, input } = await setup();
    const a = await approve(owner, ws, incidentId);
    await prs.createPullRequest({ ...input, approvalId: a.id });

    fake.checks = [{ name: 'test', status: 'completed', conclusion: 'success' }];
    await sync.syncAll();
    let [row] = await db.select().from(pullRequests).where(eq(pullRequests.workspaceId, ws));
    expect(row).toMatchObject({ status: 'open', checksStatus: 'passing' });
    expect(signals).toHaveLength(0);

    Object.assign(fake.pulls[0]!, {
      state: 'closed',
      merged: true,
      merged_at: '2026-10-20T10:00:00Z',
      merge_commit_sha: 'merge123',
    });

    const secret = process.env.GITHUB_WEBHOOK_SECRET!;
    const body = JSON.stringify({ repository: { full_name: REPO }, pull_request: { number: 7 } });
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    const hook = owner
      .post('/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sig)
      .send(body);
    await Promise.all([hook.expect(202), sync.syncAll()]);
    [row] = await db.select().from(pullRequests).where(eq(pullRequests.workspaceId, ws));
    expect(row).toMatchObject({ status: 'merged', mergeCommitSha: 'merge123' });
    expect(signals).toEqual([{ incidentId, status: 'merged' }]);

    const list = (await owner.get(`/workspaces/${ws}/pull-requests`).expect(200))
      .body as PullRequestView[];
    expect(list).toEqual([expect.objectContaining({ number: 7, status: 'merged' })]);
  });

  it('rejects webhooks with a bad signature', async () => {
    const owner = await loginAs(app, 'x@pr.test');
    await owner
      .post('/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send('{}')
      .expect(401);
  });
});
