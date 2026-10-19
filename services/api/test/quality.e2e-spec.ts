/**
 * Phase 9 online quality: engineer verdicts on hypotheses, and the outcome-based summary
 * (funnel, per-model precision, fix and verification results), scoped to one workspace.
 */
import type { INestApplication } from '@nestjs/common';
import type { IncidentInvestigation, QualitySummary } from '@ape/api-contracts';
import type { App } from 'supertest/types';
import { createDatabase } from '../src/db/client';
import {
  deployments,
  fixProposals,
  hypotheses,
  incidents,
  investigations,
  pullRequests,
  verificationRuns,
} from '../src/db/schema';
import { TemporalService } from '../src/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

describe('Quality: feedback and outcomes (e2e)', () => {
  let app: INestApplication<App>;
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);

  beforeAll(async () => {
    app = await createTestApp();
    jest.spyOn(app.get(TemporalService), 'state').mockResolvedValue(null);
  });
  beforeEach(() => resetDatabase());
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  /** An incident with a completed investigation by `model` and two hypotheses. */
  async function investigated(ws: string, model: string, n: number) {
    const now = new Date();
    const [inc] = await db
      .insert(incidents)
      .values({
        workspaceId: ws,
        title: `Incident ${n}`,
        fingerprint: `fp-${n}`,
        status: 'investigating',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning();
    const [inv] = await db
      .insert(investigations)
      .values({
        workspaceId: ws,
        incidentId: inc!.id,
        workflowId: `wf-${n}`,
        status: 'completed',
        model,
        usage: { cost_usd: 0.25, latency_ms: 20_000 },
        rejected: [{ kind: 'hypothesis', text: 'x', reason: 'cites unknown evidence' }],
      })
      .returning();
    const hs = await db
      .insert(hypotheses)
      .values(
        [1, 2].map((rank) => ({
          workspaceId: ws,
          investigationId: inv!.id,
          rank,
          summary: `H${rank}`,
        })),
      )
      .returning();
    return {
      incidentId: inc!.id,
      investigationId: inv!.id,
      top: hs.find((h) => h.rank === 1)!.id,
      second: hs.find((h) => h.rank === 2)!.id,
    };
  }

  it('records one verdict per person, lets them change it, and checks permissions', async () => {
    const owner = await loginAs(app, 'owner@q.test');
    const ws = (await createWorkspace(owner, 'Quality')).id;
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'viewer@q.test', role: 'viewer' })
      .expect(201);
    const viewer = await loginAs(app, 'viewer@q.test');
    const a = await investigated(ws, 'gemini-3.6-flash', 1);
    const b = await investigated(ws, 'gemini-3.6-flash', 2);
    const url = `/workspaces/${ws}/incidents/${a.incidentId}/investigation/feedback`;

    await viewer.post(url).send({ hypothesisId: a.top, verdict: 'correct' }).expect(403);
    // A hypothesis from another incident is not found through this incident.
    await owner.post(url).send({ hypothesisId: b.top, verdict: 'correct' }).expect(404);

    await owner.post(url).send({ hypothesisId: a.top, verdict: 'wrong' }).expect(200);
    const res = await owner
      .post(url)
      .send({ hypothesisId: a.top, verdict: 'correct', note: 'Fixed by the PR' })
      .expect(200);
    const top = (res.body as IncidentInvestigation).latest!.hypotheses.find((h) => h.rank === 1)!;
    expect(top.feedback).toEqual({ correct: 1, partly: 0, wrong: 0, mine: 'correct' });

    const seenByViewer = (
      await viewer.get(`/workspaces/${ws}/incidents/${a.incidentId}/investigation`).expect(200)
    ).body as IncidentInvestigation;
    expect(seenByViewer.latest!.hypotheses[0]!.feedback).toEqual({
      correct: 1,
      partly: 0,
      wrong: 0,
      mine: null,
    });
  });

  it('summarises real outcomes per workspace and per model', async () => {
    const owner = await loginAs(app, 'owner@q2.test');
    const ws = (await createWorkspace(owner, 'Q2')).id;
    const other = (await createWorkspace(owner, 'Other')).id;
    const g1 = await investigated(ws, 'gemini-3.6-flash', 10);
    const g2 = await investigated(ws, 'gemini-3.6-flash', 11);
    const c1 = await investigated(ws, 'claude-opus-5-5', 12);
    await investigated(other, 'claude-opus-5-5', 13); // must not be counted

    const vote = (x: { incidentId: string; top: string }, verdict: string) =>
      owner
        .post(`/workspaces/${ws}/incidents/${x.incidentId}/investigation/feedback`)
        .send({ hypothesisId: x.top, verdict })
        .expect(200);
    await vote(g1, 'correct');
    await vote(g2, 'partly');
    await vote(c1, 'wrong');
    // Verdicts on hypothesis #2 do not count towards top-1 precision.
    await owner
      .post(`/workspaces/${ws}/incidents/${c1.incidentId}/investigation/feedback`)
      .send({ hypothesisId: c1.second, verdict: 'correct' })
      .expect(200);

    // g1: validated fix, merged PR, recovered on the second window (the first was inconclusive).
    const [fix] = await db
      .insert(fixProposals)
      .values({
        workspaceId: ws,
        incidentId: g1.incidentId,
        investigationId: g1.investigationId,
        baseCommitSha: 'b',
        status: 'validated',
      })
      .returning();
    await db.insert(fixProposals).values({
      workspaceId: ws,
      incidentId: g2.incidentId,
      investigationId: g2.investigationId,
      baseCommitSha: 'b',
      status: 'not_reproduced',
    });
    await db.insert(pullRequests).values({
      workspaceId: ws,
      incidentId: g1.incidentId,
      fixProposalId: fix!.id,
      branchName: 'ai-fix/1',
      status: 'merged',
    });
    const [d] = await db
      .insert(deployments)
      .values({
        workspaceId: ws,
        serviceName: 's',
        environment: 'production',
        commitSha: 'abc1234',
        externalEventId: 'd1',
        deployedAt: new Date(),
      })
      .returning();
    const run = (incidentId: string, window: number, outcome: string, reason = '') => ({
      workspaceId: ws,
      incidentId,
      deploymentId: d!.id,
      window,
      deployCommitSha: 'abc1234',
      status: 'completed',
      outcome,
      reason,
    });
    await db
      .insert(verificationRuns)
      .values([
        run(g1.incidentId, 1, 'inconclusive'),
        run(g1.incidentId, 2, 'recovered'),
        run(c1.incidentId, 1, 'not_recovered'),
        run(g2.incidentId, 1, 'inconclusive', 'Superseded: the incident was moved to resolved'),
      ]);

    const q = (await owner.get(`/workspaces/${ws}/quality?days=30`).expect(200))
      .body as QualitySummary;
    expect(q.funnel).toEqual({
      incidents: 3,
      investigated: 3,
      fixValidated: 1,
      prMerged: 1,
      recovered: 1,
    });
    expect(q.investigations).toMatchObject({
      runs: 3,
      completed: 3,
      guardRejections: 3,
      costUsd: 0.75,
      avgLatencyMs: 20000,
    });
    expect(q.feedback).toEqual({ rated: 3, correct: 1, partly: 1, wrong: 1, top1Precision: 0.5 });
    expect(q.fixes).toEqual({ total: 2, validated: 1, validationFailed: 0, notReproduced: 1 });
    expect(q.verification).toEqual({ recovered: 1, notRecovered: 1, inconclusive: 0 });
    const byModel = Object.fromEntries(q.models.map((m) => [m.model, m]));
    expect(byModel['gemini-3.6-flash']).toMatchObject({ runs: 2, top1Rated: 2, top1Correct: 1 });
    expect(byModel['claude-opus-5-5']).toMatchObject({ runs: 1, top1Rated: 1, top1Correct: 0 });

    await owner.get(`/workspaces/${ws}/quality?days=0`).expect(400);
  });
});
