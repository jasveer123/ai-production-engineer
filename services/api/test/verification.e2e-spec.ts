/**
 * Recovery verification activities (Phase 7) against a real database: finding the deploy that
 * contains the fix, the baseline, and the recovered / not recovered / inconclusive decisions.
 */
import type { INestApplication } from '@nestjs/common';
import type { IncidentVerification } from '@ape/api-contracts';
import { and, eq } from 'drizzle-orm';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/db/client';
import {
  auditEvents,
  deployments,
  incidentEvents,
  incidents,
  integrations,
  outbox,
  pullRequests,
  fixProposals,
  investigations,
  verificationRuns,
} from '../src/db/schema';
import { GitHubAppClient, type GitHubInstallation } from '../src/github/github-app';
import { GitHubService } from '../src/github/github.service';
import { JaegerPoller } from '../src/ingestion/jaeger.poller';
import { OutboxPublisher } from '../src/temporal/outbox-publisher.service';
import { TemporalService } from '../src/temporal/temporal.service';
import { VerifyActivitiesService } from '../src/verification/verify-activities.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

const REPO = 'acct7/demo-shop';
const MERGE = 'aaaaaaa1111111111111111111111111111111aa';
const MIN = 60_000;

/** GitHub that knows which deployed commits contain the merge commit. */
class FakeGitHub extends GitHubAppClient {
  descendants = new Set<string>();
  compareCalls = 0;
  constructor() {
    super('1', 'unused');
  }
  override getInstallation(id: number): Promise<GitHubInstallation> {
    return Promise.resolve({
      id,
      account: { login: 'acct7', type: 'User' },
      repository_selection: 'selected',
      permissions: { contents: 'read', metadata: 'read' },
      suspended_at: null,
    });
  }
  override async listInstallations() {
    return [await this.getInstallation(7)];
  }
  override listRepositories() {
    return Promise.resolve([{ id: 1, full_name: REPO, default_branch: 'main', private: true }]);
  }
  override contains(_i: number, _r: string, head: string, base: string) {
    this.compareCalls++;
    return Promise.resolve(base === MERGE && this.descendants.has(head));
  }
}

describe('Recovery verification (e2e)', () => {
  let app: INestApplication<App>;
  let verify: VerifyActivitiesService;
  let fake: FakeGitHub;
  let traffic: jest.SpyInstance;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  const deploySignals: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    verify = app.get(VerifyActivitiesService);
    const temporal = app.get(TemporalService);
    jest.spyOn(temporal, 'state').mockResolvedValue(null);
    jest.spyOn(temporal, 'deployRecorded').mockImplementation((id) => {
      deploySignals.push(id);
      return Promise.resolve(true);
    });
    traffic = jest.spyOn(app.get(JaegerPoller).client, 'traceCount');
  });
  beforeEach(async () => {
    await resetDatabase();
    fake = new FakeGitHub();
    app.get(GitHubService).useClient(fake);
    traffic.mockReset().mockResolvedValue(0);
    deploySignals.length = 0;
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  /** An incident in monitoring whose fix PR merged 3 hours ago, with 30 errors/h before it. */
  async function setup(opts: { jaeger?: boolean } = {}) {
    const owner = await loginAs(app, 'owner@verify.test');
    const ws = (await createWorkspace(owner, 'Verify')).id;
    await owner.post(`/workspaces/${ws}/github/connect`).send({ installationId: 7 }).expect(201);
    const svc = (
      await owner
        .post(`/workspaces/${ws}/services`)
        .send({ name: 'shop-api', environment: 'production', repositoryFullName: REPO })
        .expect(201)
    ).body as { id: string };
    if (opts.jaeger) {
      await db.insert(integrations).values({
        workspaceId: ws,
        provider: 'otel_jaeger',
        name: 'Jaeger',
        status: 'connected',
      });
    }
    const mergedAt = new Date(Date.now() - 3 * 60 * MIN);
    const [inc] = await db
      .insert(incidents)
      .values({
        workspaceId: ws,
        serviceId: svc.id,
        serviceName: 'shop-api',
        environment: 'production',
        title: 'TypeError in discountV2',
        fingerprint: 'fp-verify',
        status: 'monitoring',
        firstSeenAt: new Date(mergedAt.getTime() - 60 * MIN),
        lastSeenAt: mergedAt,
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
        baseCommitSha: 'base',
        status: 'validated',
      })
      .returning();
    await db.insert(pullRequests).values({
      workspaceId: ws,
      incidentId: inc!.id,
      fixProposalId: fix!.id,
      repositoryFullName: REPO,
      branchName: 'ai-fix/x',
      number: 12,
      status: 'merged',
      mergeCommitSha: MERGE,
      mergedAt,
    });
    // 30 errors in the hour before the merge: the pre-fix rate.
    await errorsAt(ws, inc!.id, mergedAt.getTime() - 60 * MIN, 30, 2 * MIN);
    return { owner, ws, incidentId: inc!.id, input: { workspaceId: ws, incidentId: inc!.id } };
  }

  async function errorsAt(ws: string, incidentId: string, startMs: number, n: number, gap: number) {
    if (n === 0) return;
    await db.insert(incidentEvents).values(
      Array.from({ length: n }, (_, i) => ({
        workspaceId: ws,
        incidentId,
        kind: 'error',
        source: 'otel_jaeger',
        occurredAt: new Date(startMs + i * gap),
        summary: 'TypeError',
        attributes: { operation: 'POST /checkout' },
      })),
    );
  }

  async function deploy(ws: string, commitSha: string, atMs: number, version: string) {
    const [d] = await db
      .insert(deployments)
      .values({
        workspaceId: ws,
        serviceName: 'shop-api',
        environment: 'production',
        commitSha,
        version,
        externalEventId: `${commitSha}-${atMs}`,
        deployedAt: new Date(atMs),
      })
      .returning();
    return d!;
  }

  const status = async (id: string) =>
    (await db.select().from(incidents).where(eq(incidents.id, id)))[0]!.status;

  it('finds the first deploy that contains the merge commit, not earlier or unrelated ones', async () => {
    const { ws, input } = await setup();
    const merged = Date.now() - 3 * 60 * MIN;
    await deploy(ws, 'bbbbbbb', merged - 30 * MIN, 'v1.1.0'); // before the merge
    await deploy(ws, 'ccccccc', merged + 5 * MIN, 'v1.1.1'); // after, but without the fix
    expect(await verify.findFixDeploy({ ...input, mergeCommitSha: MERGE })).toEqual({
      status: 'not_yet',
    });

    fake.descendants.add('ddddddd');
    const fixDeploy = await deploy(ws, 'ddddddd', merged + 20 * MIN, 'v1.2.0');
    expect(await verify.findFixDeploy({ ...input, mergeCommitSha: MERGE })).toMatchObject({
      status: 'found',
      deploymentId: fixDeploy.id,
    });
  });

  it('matches the merge sha directly without asking GitHub', async () => {
    const { ws, input } = await setup();
    const d = await deploy(ws, MERGE.slice(0, 7), Date.now() - 2 * 60 * MIN, 'v1.2.0');
    const r = await verify.findFixDeploy({ ...input, mergeCommitSha: MERGE });
    expect(r).toMatchObject({ status: 'found', deploymentId: d.id });
    expect(fake.compareCalls).toBe(0);
  });

  it('stops when a human already moved the incident out of monitoring', async () => {
    const { input, incidentId } = await setup();
    await db.update(incidents).set({ status: 'resolved' }).where(eq(incidents.id, incidentId));
    expect(await verify.findFixDeploy({ ...input, mergeCommitSha: MERGE })).toEqual({
      status: 'superseded',
    });
  });

  it('resolves when the error stops where the pre-fix rate predicted more', async () => {
    const { ws, input, incidentId, owner } = await setup();
    const d = await deploy(ws, MERGE, Date.now() - 2 * 60 * MIN, 'v1.2.0');
    const run = await verify.startVerification({ ...input, deploymentId: d.id, window: 1 });
    expect(run.waitMs).toBe(0); // the 30-minute window is already in the past
    // Retrying the activity reuses the row.
    expect(
      (await verify.startVerification({ ...input, deploymentId: d.id, window: 1 }))
        .verificationRunId,
    ).toBe(run.verificationRunId);

    const result = await verify.evaluateVerification({
      verificationRunId: run.verificationRunId,
      interim: false,
      finalWindow: false,
    });
    expect(result).toMatchObject({ outcome: 'recovered', superseded: false });
    expect(result.reason).toContain('about 8 were expected');
    expect(await status(incidentId)).toBe('resolved');

    const [row] = await db.select().from(verificationRuns);
    expect(row).toMatchObject({ status: 'completed', outcome: 'recovered' });
    expect(row!.baseline).toMatchObject({ errors: 30, errorsPerHour: 15 });
    const audit = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.workspaceId, ws), eq(auditEvents.action, 'verification.recovered')),
      );
    expect(audit).toHaveLength(1);

    // A retried evaluation reports the stored result and changes nothing.
    expect(
      await verify.evaluateVerification({
        verificationRunId: run.verificationRunId,
        interim: false,
        finalWindow: false,
      }),
    ).toMatchObject({ outcome: 'recovered' });

    const view = (
      await owner.get(`/workspaces/${ws}/incidents/${incidentId}/verification`).expect(200)
    ).body as IncidentVerification;
    expect(view.runs).toHaveLength(1);
    expect(view.runs[0]).toMatchObject({ outcome: 'recovered', deployVersion: 'v1.2.0' });
  });

  it('needs attention when the error keeps happening, naming the rollback candidate', async () => {
    const { ws, input, incidentId } = await setup();
    const deployedAt = Date.now() - 2 * 60 * MIN;
    await deploy(ws, 'eeeeeee', deployedAt - 4 * 60 * MIN, 'v1.1.0');
    const d = await deploy(ws, MERGE, deployedAt, 'v1.2.0');
    await errorsAt(ws, incidentId, deployedAt + 5 * MIN, 4, MIN);
    const run = await verify.startVerification({ ...input, deploymentId: d.id, window: 1 });
    const result = await verify.evaluateVerification({
      verificationRunId: run.verificationRunId,
      interim: true, // an interim check is enough to conclude this
      finalWindow: false,
    });
    expect(result.outcome).toBe('not_recovered');
    expect(result.reason).toContain('4 errors with the same fingerprint');
    expect(result.reason).toContain('previous deploy was v1.1.0 (eeeeeee)');
    expect(await status(incidentId)).toBe('needs_attention');
  });

  it('extends an inconclusive window, then ends inconclusive on the last one', async () => {
    const { ws, input, incidentId } = await setup({ jaeger: true });
    // A quiet incident: 2 errors in the hour before, so ~1 expected per 30-minute window.
    await db.delete(incidentEvents).where(eq(incidentEvents.incidentId, incidentId));
    await errorsAt(ws, incidentId, Date.now() - 3.5 * 60 * MIN, 2, MIN);
    const d = await deploy(ws, MERGE, Date.now() - 2 * 60 * MIN, 'v1.2.0');
    traffic.mockResolvedValue(3); // too little traffic to call it

    const w1 = await verify.startVerification({ ...input, deploymentId: d.id, window: 1 });
    const r1 = await verify.evaluateVerification({
      verificationRunId: w1.verificationRunId,
      interim: false,
      finalWindow: false,
    });
    expect(r1.outcome).toBe('inconclusive');
    expect(r1.reason).toContain('only 3 requests (need 20)');
    expect(await status(incidentId)).toBe('monitoring');
    expect(traffic).toHaveBeenCalledWith(
      'shop-api',
      'POST /checkout',
      expect.any(Number),
      expect.any(Number),
    );

    const w2 = await verify.startVerification({ ...input, deploymentId: d.id, window: 2 });
    const r2 = await verify.evaluateVerification({
      verificationRunId: w2.verificationRunId,
      interim: false,
      finalWindow: true,
    });
    expect(r2.outcome).toBe('inconclusive');
    expect(await status(incidentId)).toBe('verification_inconclusive');
    const runs = await db.select().from(verificationRuns);
    expect(runs.map((r) => r.window).sort()).toEqual([1, 2]);
  });

  it('resolves on traffic alone when Jaeger shows enough clean requests', async () => {
    const { ws, input, incidentId } = await setup({ jaeger: true });
    await db.delete(incidentEvents).where(eq(incidentEvents.incidentId, incidentId));
    await errorsAt(ws, incidentId, Date.now() - 3.5 * 60 * MIN, 1, MIN);
    const d = await deploy(ws, MERGE, Date.now() - 2 * 60 * MIN, 'v1.2.0');
    traffic.mockResolvedValue(250);
    const run = await verify.startVerification({ ...input, deploymentId: d.id, window: 1 });
    const r = await verify.evaluateVerification({
      verificationRunId: run.verificationRunId,
      interim: false,
      finalWindow: false,
    });
    expect(r).toMatchObject({ outcome: 'recovered' });
    expect(r.reason).toContain('250 requests');
    expect(await status(incidentId)).toBe('resolved');
  });

  it('does not overwrite a status a human set while the window was open', async () => {
    const { ws, input, incidentId } = await setup();
    const d = await deploy(ws, MERGE, Date.now() - 2 * 60 * MIN, 'v1.2.0');
    await errorsAt(ws, incidentId, Date.now() - 100 * MIN, 5, MIN);
    const run = await verify.startVerification({ ...input, deploymentId: d.id, window: 1 });
    await db.update(incidents).set({ status: 'resolved' }).where(eq(incidents.id, incidentId));
    const r = await verify.evaluateVerification({
      verificationRunId: run.verificationRunId,
      interim: false,
      finalWindow: true,
    });
    expect(r.superseded).toBe(true);
    expect(await status(incidentId)).toBe('resolved');
  });

  it('marks the incident inconclusive when no deploy with the fix arrives', async () => {
    const { input, incidentId } = await setup();
    await verify.noFixDeploy({ ...input, waitedMs: 7 * 24 * 60 * MIN });
    expect(await status(incidentId)).toBe('verification_inconclusive');
    const [e] = await db
      .select()
      .from(incidentEvents)
      .where(
        and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'status_change')),
      );
    expect(e!.summary).toContain('within 7 day(s)');
  });

  it('wakes workflows of incidents waiting on that service when a deploy is recorded', async () => {
    const { ws, incidentId } = await setup();
    await db.insert(outbox).values({
      workspaceId: ws,
      topic: 'deploy.recorded',
      payload: { serviceName: 'shop-api', environment: 'production', deploymentId: 'x' },
    });
    await db.insert(outbox).values({
      workspaceId: ws,
      topic: 'deploy.recorded',
      payload: { serviceName: 'other-service', environment: 'production', deploymentId: 'y' },
    });
    expect(await app.get(OutboxPublisher).publishBatch()).toBe(2);
    expect(deploySignals).toEqual([incidentId]);
  });
});
