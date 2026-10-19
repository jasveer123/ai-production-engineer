/* eslint-disable @typescript-eslint/require-await -- stub activities must return promises */
/**
 * Workflow B (reproduce -> patch -> validate) with every activity stubbed: checks the control
 * flow, bounded patch attempts, and that AI failures never fail the incident workflow.
 */
import { randomUUID } from 'node:crypto';
import { ApplicationFailure } from '@temporalio/activity';
import { Client, Connection } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import {
  approvePullRequest,
  approveReproduction,
  pullRequestStatus,
  rejectFix,
  stateQuery,
  TASK_QUEUES,
  type PullRequestOutcome,
  type SandboxRunResult,
} from '@ape/temporal-workflows';

jest.setTimeout(120_000);
const NAMESPACE = process.env.TEMPORAL_NAMESPACE!;
const ADDRESS = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';

const run = (
  status: SandboxRunResult['status'],
  files: { file: string; tests: number; failures: number }[],
): SandboxRunResult => ({
  status,
  reason: null,
  exitCode: status === 'passed' ? 0 : 1,
  durationMs: 10,
  summary: {
    tests: files.reduce((a, f) => a + f.tests, 0),
    failures: files.reduce((a, f) => a + f.failures, 0),
    errors: 0,
    skipped: 0,
    files,
  },
  outputRef: `s3://test/${randomUUID()}`,
});

const behaviour = {
  generateTest: async () => ({
    status: 'ok' as const,
    reason: null,
    testRef: 's3://t/test',
    rationale: 'r',
  }),
  generatePatch: async () => ({
    status: 'ok' as const,
    reason: null,
    patchRef: 's3://t/patch',
    explanation: 'e',
  }),
  validationPasses: true,
  pr: { status: 'created', number: 7, url: 'u' } as PullRequestOutcome,
};
const fixUpdates: { status: string; reason?: string | null }[] = [];
const statuses: string[] = [];
const prCalls: string[] = [];

describe('Workflow B: reproduce, patch, validate (stubbed activities)', () => {
  let workers: Worker[];
  let running: Promise<unknown>[];
  let client: Client;
  let connection: Connection;

  beforeAll(async () => {
    const nc = await NativeConnection.connect({ address: ADDRESS });
    const evidence = {
      startInvestigation: async () => ({ investigationId: 'inv' }),
      collectEvidence: async () => ({ bundleRef: 'b', evidenceCount: 1 }),
      publishReport: async () => undefined,
      markInvestigation: async () => undefined,
      closeIncident: async () => undefined,
      recordReproductionApproval: async () => undefined,
      prepareFix: async () => ({
        ok: true as const,
        fixProposalId: 'fix',
        sourceRef: 's',
        contextRef: 'c',
        profile: {
          runtime: 'node22-pnpm' as const,
          packageDir: 'api',
          testCommand: 'x',
          testDir: 'test',
        },
        testPath: 'api/test/ape-regression.test.ts',
      }),
      recordRun: async () => undefined,
      applyPatch: async () => ({
        ok: true,
        overlayRef: 'o',
        violations: [],
        diffStat: { files: 1, additions: 2, deletions: 1 },
      }),
      updateFix: async (u: { status: string; reason?: string | null }) => {
        fixUpdates.push(u);
      },
      setIncidentStatus: async ({ to }: { to: string }) => {
        statuses.push(to);
      },
      createPullRequest: async ({ approvalId }: { approvalId: string }) => {
        prCalls.push(approvalId);
        return behaviour.pr;
      },
      testOverlay: async () => ({ overlayRef: 't' }),
    };
    workers = await Promise.all([
      Worker.create({
        connection: nc,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.incident,
        workflowsPath: require.resolve('@ape/temporal-workflows/dist/workflows'),
      }),
      Worker.create({
        connection: nc,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.evidence,
        activities: evidence,
      }),
      Worker.create({
        connection: nc,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.ai,
        activities: {
          investigate: async () => ({
            status: 'completed',
            reason: null,
            reportRef: 'r',
            model: 'm',
          }),
          generateTest: () => behaviour.generateTest(),
          generatePatch: () => behaviour.generatePatch(),
        },
      }),
      Worker.create({
        connection: nc,
        namespace: NAMESPACE,
        taskQueue: TASK_QUEUES.sandbox,
        activities: {
          prepareImage: async () => ({ image: 'img' }),
          runSuite: async ({ label }: { label: string }) => {
            if (label === 'baseline')
              return run('passed', [{ file: 'test/a.test.ts', tests: 5, failures: 0 }]);
            if (label === 'reproduction')
              return run('failed', [
                { file: 'test/ape-regression.test.ts', tests: 1, failures: 1 },
              ]);
            const ok = behaviour.validationPasses;
            return run(ok ? 'passed' : 'failed', [
              { file: 'test/a.test.ts', tests: 5, failures: 0 },
              { file: 'test/ape-regression.test.ts', tests: 1, failures: ok ? 0 : 1 },
            ]);
          },
        },
      }),
    ]);
    running = workers.map((w) => w.run());
    connection = await Connection.connect({ address: ADDRESS });
    client = new Client({ connection, namespace: NAMESPACE });
  });

  afterAll(async () => {
    workers.forEach((w) => w.shutdown());
    await Promise.allSettled(running);
    await connection.close();
  });

  beforeEach(() => {
    fixUpdates.length = 0;
    statuses.length = 0;
    prCalls.length = 0;
    behaviour.pr = { status: 'created', number: 7, url: 'u' };
    behaviour.validationPasses = true;
    behaviour.generateTest = async () => ({
      status: 'ok',
      reason: null,
      testRef: 's3://t/test',
      rationale: 'r',
    });
    behaviour.generatePatch = async () => ({
      status: 'ok',
      reason: null,
      patchRef: 's3://t/patch',
      explanation: 'e',
    });
  });

  async function startAndApprove() {
    const handle = await client.workflow.start('incidentWorkflow', {
      workflowId: `wf-fix-${randomUUID()}`,
      taskQueue: TASK_QUEUES.incident,
      args: [{ incidentId: randomUUID(), workspaceId: randomUUID() }],
    });
    await waitPhase(handle, 'awaiting_decision');
    await handle.signal(approveReproduction, { actorId: 'u1' });
    await waitPhase(handle, 'awaiting_fix_decision');
    return handle;
  }

  async function waitPhase(
    handle: { query: (q: typeof stateQuery) => Promise<{ phase: string }> },
    phase: string,
  ) {
    for (let i = 0; i < 200; i++) {
      if ((await handle.query(stateQuery)).phase === phase) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`phase ${phase} not reached`);
  }

  it('validates a patch, opens the PR on approval and completes when it is merged', async () => {
    const handle = await startAndApprove();
    expect(fixUpdates.map((u) => u.status)).toContain('validated');
    await handle.signal(approvePullRequest, { actorId: 'u1', approvalId: 'a1' });
    await waitPhase(handle, 'pr_open');
    expect(prCalls).toEqual(['a1']);
    await handle.signal(pullRequestStatus, { status: 'merged', number: 7, mergeCommitSha: 'm' });
    expect(await handle.result()).toBe('pr_merged');
    expect(statuses.at(-1)).toBe('monitoring');
  });

  it('goes back to a decision when the PR is blocked or closed without merging', async () => {
    behaviour.pr = { status: 'blocked', reason: 'patch changed' };
    const handle = await startAndApprove();
    await handle.signal(approvePullRequest, { actorId: 'u1', approvalId: 'a1' });
    await waitPhase(handle, 'awaiting_fix_decision');
    behaviour.pr = { status: 'created', number: 8, url: 'u' };
    await handle.signal(approvePullRequest, { actorId: 'u1', approvalId: 'a2' });
    await waitPhase(handle, 'pr_open');
    await handle.signal(pullRequestStatus, { status: 'closed', number: 8, mergeCommitSha: null });
    await waitPhase(handle, 'awaiting_fix_decision');
    expect(statuses.at(-1)).toBe('fix_proposed');
    await handle.signal(rejectFix, { actorId: 'u1', reason: 'no' });
    expect(await handle.result()).toBe('fix_rejected');
  });

  it('stops after the bounded number of patch attempts and keeps the workflow alive', async () => {
    behaviour.validationPasses = false;
    const handle = await startAndApprove();
    const patching = fixUpdates.filter((u) => u.status === 'patching');
    expect(patching).toHaveLength(3);
    expect(fixUpdates.at(-1)?.status).toBe('validation_failed');
    await handle.signal(rejectFix, { actorId: 'u1', reason: 'no good' });
    expect(await handle.result()).toBe('fix_rejected');
  });

  it('survives the AI being unavailable for the patch (e.g. quota exhausted)', async () => {
    behaviour.generatePatch = async () => {
      throw ApplicationFailure.nonRetryable('429 RESOURCE_EXHAUSTED', 'ModelUnavailable');
    };
    const handle = await startAndApprove();
    expect(fixUpdates.at(-1)).toMatchObject({ status: 'validation_failed' });
    expect(String(fixUpdates.at(-1)?.reason)).toContain('AI unavailable');
    expect((await handle.describe()).status.name).toBe('RUNNING');
  });

  it('survives the AI being unavailable for the test', async () => {
    behaviour.generateTest = async () => {
      throw ApplicationFailure.nonRetryable('quota', 'ModelUnavailable');
    };
    const handle = await startAndApprove();
    expect(fixUpdates.at(-1)).toMatchObject({ status: 'error' });
    expect((await handle.describe()).status.name).toBe('RUNNING');
  });
});
