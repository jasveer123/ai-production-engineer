import {
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import {
  MAX_PATCH_ATTEMPTS,
  PATCH_PROMPT_VERSION,
  PROMPT_VERSION,
  TASK_QUEUES,
  TEST_PROMPT_VERSION,
  type FixActivities,
  type FixAiActivities,
  type GeneratePatchResult,
  type GenerateTestResult,
  type PrepareFixResult,
  type PrActivities,
  type PrStatusSignal,
  type SandboxActivities,
  type Actor,
  type AiActivities,
  type EvidenceActivities,
  type IncidentWorkflowInput,
  type VerifyActivities,
  type WorkflowState,
} from './contracts';

export const approveReproduction = defineSignal<[Actor]>('approveReproduction');
export const requestMoreInvestigation = defineSignal<[Actor & { note: string | null }]>(
  'requestMoreInvestigation',
);
export const dismiss = defineSignal<[Actor & { reason: string }]>('dismiss');
export const stateQuery = defineQuery<WorkflowState>('state');
export const regenerateFix = defineSignal<[Actor & { note: string | null }]>('regenerateFix');
export const rejectFix = defineSignal<[Actor & { reason: string }]>('rejectFix');
export const approvePullRequest =
  defineSignal<[Actor & { approvalId: string }]>('approvePullRequest');
export const pullRequestStatus = defineSignal<[PrStatusSignal]>('pullRequestStatus');

export const deployRecorded = defineSignal('deployRecorded');

const evidence = proxyActivities<EvidenceActivities>({
  taskQueue: TASK_QUEUES.evidence,
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 5, initialInterval: '2 seconds', backoffCoefficient: 2 },
});

const ai = proxyActivities<AiActivities>({
  taskQueue: TASK_QUEUES.ai,
  startToCloseTimeout: '5 minutes',
  scheduleToCloseTimeout: '20 minutes',
  retry: { maximumAttempts: 3, initialInterval: '10 seconds', backoffCoefficient: 2 },
});

const fixes = proxyActivities<FixActivities>({
  taskQueue: TASK_QUEUES.evidence,
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 5, initialInterval: '2 seconds', backoffCoefficient: 2 },
});

const prs = proxyActivities<PrActivities>({
  taskQueue: TASK_QUEUES.evidence,
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 5, initialInterval: '5 seconds', backoffCoefficient: 2 },
});

const fixAi = proxyActivities<FixAiActivities>({
  taskQueue: TASK_QUEUES.ai,
  startToCloseTimeout: '5 minutes',
  scheduleToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 3, initialInterval: '10 seconds', backoffCoefficient: 2 },
});

const verify = proxyActivities<VerifyActivities>({
  taskQueue: TASK_QUEUES.evidence,
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 10, initialInterval: '5 seconds', backoffCoefficient: 2 },
});

const sandbox = proxyActivities<SandboxActivities>({
  taskQueue: TASK_QUEUES.sandbox,
  startToCloseTimeout: '20 minutes',
  heartbeatTimeout: '1 minute',
  retry: { maximumAttempts: 2, initialInterval: '10 seconds' },
});

const errText = (err: unknown): string => {
  const cause = (err as { cause?: { message?: string } }).cause?.message;
  return (cause ?? (err instanceof Error ? err.message : String(err))).slice(0, 500);
};

const failureText = (s: { failures: number; errors: number; tests: number }) =>
  `${s.failures + s.errors} of ${s.tests} tests failed`;

async function reproduceAndFix(
  input: IncidentWorkflowInput,
  state: WorkflowState,
  version: number,
): Promise<{ outcome: 'validated' | 'stopped'; fixProposalId: string | null }> {
  const runKey = `${workflowInfo().workflowId}:${workflowInfo().runId}`;
  state.phase = 'reproducing';
  let prep: PrepareFixResult;
  try {
    prep = await fixes.prepareFix({ ...input, runKey, version });
  } catch (err) {
    if (isCancellation(err)) throw err;
    return { outcome: 'stopped', fixProposalId: null };
  }
  if (!prep.ok) return { outcome: 'stopped', fixProposalId: prep.fixProposalId };
  const { fixProposalId } = prep;
  try {
    return { outcome: await runFixStages(input, state, prep), fixProposalId };
  } catch (err) {
    if (isCancellation(err)) throw err;

    await fixes.updateFix({ fixProposalId, status: 'error', reason: errText(err) });
    return { outcome: 'stopped', fixProposalId };
  }
}

async function runFixStages(
  input: IncidentWorkflowInput,
  state: WorkflowState,
  prep: Extract<PrepareFixResult, { ok: true }>,
): Promise<'validated' | 'stopped'> {
  const { fixProposalId, sourceRef, contextRef, profile, testPath } = prep;
  const onlyTest = [testPath.slice(profile.packageDir.length + 1)];

  const { image } = await sandbox.prepareImage({ sourceRef, profile });
  const baseline = await sandbox.runSuite({
    sourceRef,
    image,
    profile,
    overlayRef: null,
    only: null,
    label: 'baseline',
  });
  await fixes.recordRun({ fixProposalId, kind: 'baseline', attempt: 0, image, result: baseline });
  if (baseline.status !== 'passed') {
    await fixes.updateFix({
      fixProposalId,
      status: 'baseline_failed',
      reason:
        baseline.reason ??
        `Existing tests fail before any change: ${failureText(baseline.summary)}`,
    });
    return 'stopped';
  }

  let test: GenerateTestResult;
  try {
    test = await fixAi.generateTest({
      fixProposalId,
      workspaceId: input.workspaceId,
      contextRef,
      testPath,
      promptVersion: TEST_PROMPT_VERSION,
    });
  } catch (err) {
    if (isCancellation(err)) throw err;
    test = {
      status: 'failed',
      reason: `AI unavailable: ${errText(err)}`,
      testRef: null,
      rationale: null,
    };
  }
  if (test.status !== 'ok' || !test.testRef) {
    await fixes.updateFix({
      fixProposalId,
      status: 'error',
      reason: `Could not write a test: ${test.reason}`,
    });
    return 'stopped';
  }
  await fixes.updateFix({
    fixProposalId,
    status: 'reproducing',
    testRef: test.testRef,
    testRationale: test.rationale ?? undefined,
  });
  const { overlayRef: testOnly } = await fixes.testOverlay({
    fixProposalId,
    testRef: test.testRef,
  });
  const repro = await sandbox.runSuite({
    sourceRef,
    image,
    profile,
    overlayRef: testOnly,
    only: onlyTest,
    label: 'reproduction',
  });

  const reproduced = repro.status === 'failed';
  await fixes.recordRun({
    fixProposalId,
    kind: 'reproduction',
    attempt: 0,
    image,
    result: {
      ...repro,
      status: reproduced ? 'passed' : 'failed',
      reason: reproduced ? 'bug_reproduced' : (repro.reason ?? 'test_passed_on_buggy_code'),
    },
  });
  if (!reproduced) {
    await fixes.updateFix({
      fixProposalId,
      status: 'not_reproduced',
      reason:
        repro.status === 'passed'
          ? 'The generated test passes on the current code'
          : `The test did not run (${repro.reason})`,
    });
    return 'stopped';
  }

  let failureRef: string = repro.outputRef;
  let feedback: string | null = null;
  await fixes.setIncidentStatus({
    ...input,
    to: 'fix_proposed',
    summary: 'Bug reproduced by a failing regression test',
  });
  for (let attempt = 1; attempt <= MAX_PATCH_ATTEMPTS; attempt++) {
    state.phase = 'patching';
    await fixes.updateFix({ fixProposalId, status: 'patching', patchAttempts: attempt });
    let patch: GeneratePatchResult;
    try {
      patch = await fixAi.generatePatch({
        fixProposalId,
        workspaceId: input.workspaceId,
        contextRef,
        testRef: test.testRef,
        failureRef,
        attempt,
        feedback,
        promptVersion: PATCH_PROMPT_VERSION,
      });
    } catch (err) {
      if (isCancellation(err)) throw err;
      patch = {
        status: 'failed',
        reason: `AI unavailable: ${errText(err)}`,
        patchRef: null,
        explanation: null,
      };
    }
    if (patch.status !== 'ok' || !patch.patchRef) {
      feedback = `Attempt ${attempt} produced no usable patch: ${patch.reason}`;
      continue;
    }
    const applied = await fixes.applyPatch({
      fixProposalId,
      attempt,
      patchRef: patch.patchRef,
      testRef: test.testRef,
    });
    if (!applied.ok || !applied.overlayRef) {
      feedback = `Attempt ${attempt} was rejected by policy: ${applied.violations.join('; ')}`;
      continue;
    }
    state.phase = 'validating';
    await fixes.setIncidentStatus({
      ...input,
      to: 'validation',
      summary: `Validating patch attempt ${attempt}`,
    });
    await fixes.updateFix({ fixProposalId, status: 'validating' });
    const suite = await sandbox.runSuite({
      sourceRef,
      image,
      profile,
      overlayRef: applied.overlayRef,
      only: null,
      label: `validation-${attempt}`,
    });
    const regFile = suite.summary.files.find((f) => f.file.endsWith(onlyTest[0]!));
    const regression = regFile
      ? {
          status: (regFile.failures === 0 ? 'passed' : 'failed') as 'passed' | 'failed',
          tests: regFile.tests,
          failures: regFile.failures,
        }
      : { status: 'error' as const, tests: 0, failures: 0 };
    await fixes.recordRun({
      fixProposalId,
      kind: 'regression',
      attempt,
      image,
      result: {
        status: suite.status === 'error' ? 'error' : regression.status,
        reason: suite.reason,
        summary: regression,
        outputRef: suite.outputRef,
        durationMs: suite.durationMs,
        exitCode: suite.exitCode,
      },
    });
    await fixes.recordRun({ fixProposalId, kind: 'full_suite', attempt, image, result: suite });
    if (suite.status === 'passed') {
      await fixes.updateFix({
        fixProposalId,
        status: 'validated',
        reason: null,
        explanation: patch.explanation ?? undefined,
      });
      await fixes.setIncidentStatus({
        ...input,
        to: 'awaiting_review',
        summary: `Patch attempt ${attempt} passed the regression test and the full suite`,
      });
      return 'validated';
    }
    await fixes.setIncidentStatus({
      ...input,
      to: 'validation_failed',
      summary: `Patch attempt ${attempt} failed validation`,
    });
    failureRef = suite.outputRef;
    feedback = `Attempt ${attempt} failed validation: ${suite.reason ?? failureText(suite.summary)}. See the new test output.`;
  }
  await fixes.updateFix({ fixProposalId, status: 'validation_failed', reason: feedback });
  return 'stopped';
}

export async function incidentWorkflow(input: IncidentWorkflowInput): Promise<string> {
  const state: WorkflowState = { phase: 'investigating', attempt: 0 };
  let more: (Actor & { note: string | null }) | null = null;
  let approved: Actor | null = null;
  let dismissed: (Actor & { reason: string }) | null = null;

  setHandler(stateQuery, () => state);
  setHandler(requestMoreInvestigation, (s) => {
    more ??= s;
  });
  setHandler(approveReproduction, (s) => {
    approved ??= s;
  });
  setHandler(dismiss, (s) => {
    dismissed ??= s;
  });

  for (;;) {
    state.attempt += 1;
    state.phase = 'investigating';
    const note: string | null = more ? (more as Actor & { note: string | null }).note : null;
    more = null;

    const { investigationId, blocked } = await evidence.startInvestigation({
      ...input,
      workflowId: workflowInfo().workflowId,
      runId: workflowInfo().runId,
      attempt: state.attempt,
      note,
    });

    if (!blocked)
      try {
        const bundle = await evidence.collectEvidence({ investigationId });
        const result = await ai.investigate({
          investigationId,
          workspaceId: input.workspaceId,
          bundleRef: bundle.bundleRef,
          promptVersion: PROMPT_VERSION,
        });
        await evidence.publishReport({ investigationId, result });
      } catch (err) {
        const cancelled = isCancellation(err);

        await CancellationScope.nonCancellable(() =>
          evidence.markInvestigation({
            investigationId,
            status: cancelled ? 'cancelled' : 'failed',
            reason: err instanceof Error ? err.message : String(err),
          }),
        );
        if (cancelled) {
          state.phase = 'cancelled';
          throw err;
        }
      }

    state.phase = 'awaiting_decision';
    await condition(() => more !== null || approved !== null || dismissed !== null);

    if (dismissed) {
      const d = dismissed as Actor & { reason: string };
      await evidence.closeIncident({ ...input, actorId: d.actorId, reason: d.reason });
      state.phase = 'dismissed';
      return 'dismissed';
    }
    if (approved) {
      await evidence.recordReproductionApproval({ ...input, actorId: (approved as Actor).actorId });
      state.phase = 'reproduction_approved';
      return await fixLoop(input, state);
    }
  }
}

async function fixLoop(input: IncidentWorkflowInput, state: WorkflowState): Promise<string> {
  let regenerate: (Actor & { note: string | null }) | null = null;
  let rejected: (Actor & { reason: string }) | null = null;
  let prApproved: (Actor & { approvalId: string }) | null = null;
  let prStatus: PrStatusSignal | null = null;
  setHandler(regenerateFix, (s) => {
    regenerate ??= s;
  });
  setHandler(rejectFix, (s) => {
    rejected ??= s;
  });
  setHandler(approvePullRequest, (s) => {
    prApproved ??= s;
  });
  setHandler(pullRequestStatus, (s) => {
    prStatus = s;
  });

  for (let version = 1; ; version++) {
    const { outcome, fixProposalId } = await reproduceAndFix(input, state, version);
    for (;;) {
      state.phase = 'awaiting_fix_decision';
      await condition(
        () =>
          regenerate !== null ||
          rejected !== null ||
          (prApproved !== null && outcome === 'validated'),
      );
      if (rejected) {
        const r = rejected as Actor & { reason: string };
        await evidence.closeIncident({ ...input, actorId: r.actorId, reason: r.reason });
        state.phase = 'fix_rejected';
        return 'fix_rejected';
      }
      if (regenerate) break;

      const approval = prApproved as unknown as Actor & { approvalId: string };
      prApproved = null;
      state.phase = 'pr_approved';
      const pr = await prs.createPullRequest({
        ...input,
        fixProposalId: fixProposalId!,
        approvalId: approval.approvalId,
      });
      if (pr.status === 'blocked') continue;

      state.phase = 'pr_open';
      prStatus = null;
      await condition(() => prStatus !== null || rejected !== null);
      if (rejected) continue;
      const st = prStatus as unknown as PrStatusSignal;
      await fixes.setIncidentStatus({
        ...input,
        to: st.status === 'merged' ? 'monitoring' : 'fix_proposed',
        summary:
          st.status === 'merged'
            ? `Pull request #${st.number} merged; monitoring for recovery`
            : `Pull request #${st.number} was closed without merging`,
      });
      if (st.status === 'merged') {
        state.phase = 'pr_merged';
        return await verifyRecovery(input, state, st);
      }
    }
    regenerate = null;
  }
}

async function verifyRecovery(
  input: IncidentWorkflowInput,
  state: WorkflowState,
  merge: PrStatusSignal,
): Promise<string> {
  let deploys = 0;
  setHandler(deployRecorded, () => {
    deploys += 1;
  });
  const plan = await verify.beginMonitoring({
    ...input,
    mergeCommitSha: merge.mergeCommitSha,
    prNumber: merge.number,
  });

  state.phase = 'awaiting_deploy';
  const waitStarted = Date.now();
  let deploymentId: string;
  for (;;) {
    const found = await verify.findFixDeploy({ ...input, mergeCommitSha: merge.mergeCommitSha });
    if (found.status === 'superseded') return 'superseded';
    if (found.status === 'found') {
      deploymentId = found.deploymentId;
      break;
    }
    const remaining = plan.deployWaitMs - (Date.now() - waitStarted);
    if (remaining <= 0) {
      await verify.noFixDeploy({ ...input, waitedMs: plan.deployWaitMs });
      state.phase = 'verification_inconclusive';
      return 'no_fix_deploy';
    }
    const seen = deploys;
    await condition(() => deploys > seen, Math.min(plan.deployPollMs, remaining));
  }

  state.phase = 'verifying';
  for (let window = 1; window <= plan.maxWindows; window++) {
    const run = await verify.startVerification({ ...input, deploymentId, window });
    const finalWindow = window === plan.maxWindows;

    let left = run.waitMs;
    while (left > 0) {
      const step = Math.min(left, run.checkEveryMs);
      await sleep(step);
      left -= step;
      if (left <= 0) break;
      const interim = await verify.evaluateVerification({
        verificationRunId: run.verificationRunId,
        interim: true,
        finalWindow,
      });
      if (interim.superseded) return 'superseded';
      if (interim.outcome === 'not_recovered') {
        state.phase = 'not_recovered';
        return 'not_recovered';
      }
    }
    const result = await verify.evaluateVerification({
      verificationRunId: run.verificationRunId,
      interim: false,
      finalWindow,
    });
    if (result.superseded) return 'superseded';
    if (result.outcome === 'recovered') {
      state.phase = 'resolved';
      return 'resolved';
    }
    if (result.outcome === 'not_recovered') {
      state.phase = 'not_recovered';
      return 'not_recovered';
    }
  }
  state.phase = 'verification_inconclusive';
  return 'verification_inconclusive';
}
