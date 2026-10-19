// Workflow code must be deterministic: no I/O, clocks or randomness outside Temporal APIs.
import {
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
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
  type SandboxActivities,
  type Actor,
  type AiActivities,
  type EvidenceActivities,
  type IncidentWorkflowInput,
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
export const approvePullRequest = defineSignal<[Actor]>('approvePullRequest');

const evidence = proxyActivities<EvidenceActivities>({
  taskQueue: TASK_QUEUES.evidence,
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 5, initialInterval: '2 seconds', backoffCoefficient: 2 },
});

// Model calls are slow and cost money: fewer retries, longer timeout, bounded overall.
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

const fixAi = proxyActivities<FixAiActivities>({
  taskQueue: TASK_QUEUES.ai,
  startToCloseTimeout: '5 minutes',
  scheduleToCloseTimeout: '15 minutes',
  retry: { maximumAttempts: 3, initialInterval: '10 seconds', backoffCoefficient: 2 },
});

// Builds may download dependencies once; test runs are offline and bounded inside the sandbox.
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

/**
 * Workflow B (Phase 5): pin the code, prove the existing tests pass, reproduce the bug with a
 * failing test, then try up to MAX_PATCH_ATTEMPTS minimal patches until the regression test and
 * the full suite pass. Every run is recorded; a failed validation is reported, never hidden.
 */
async function reproduceAndFix(
  input: IncidentWorkflowInput,
  state: WorkflowState,
  version: number,
): Promise<'validated' | 'stopped'> {
  const runKey = `${workflowInfo().workflowId}:${workflowInfo().runId}`;
  state.phase = 'reproducing';
  let prep: PrepareFixResult;
  try {
    prep = await fixes.prepareFix({ ...input, runKey, version });
  } catch (err) {
    if (isCancellation(err)) throw err;
    return 'stopped';
  }
  if (!prep.ok) return 'stopped';
  const { fixProposalId } = prep;
  try {
    return await runFixStages(input, state, prep);
  } catch (err) {
    if (isCancellation(err)) throw err;
    // An unexpected failure (sandbox, storage) ends this fix version, not the incident workflow.
    await fixes.updateFix({ fixProposalId, status: 'error', reason: errText(err) });
    return 'stopped';
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
    // The project's own tests don't pass here: an environment problem, not the patch's fault.
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
  // Reproduced means the new test ran and failed. Passing, or not running at all, is not a reproduction.
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

/**
 * One workflow per incident (id `incident-<incidentId>`): investigate, then wait for a human
 * decision. "Investigate further" runs another attempt; "Approve reproduction" hands over to the
 * reproduce-and-fix stage (Phase 5); "Dismiss" closes the incident without a fix.
 */
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

    const { investigationId } = await evidence.startInvestigation({
      ...input,
      workflowId: workflowInfo().workflowId,
      runId: workflowInfo().runId,
      attempt: state.attempt,
      note,
    });

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
      // Record the outcome even while the workflow itself is being cancelled.
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
    // Otherwise "Investigate further": loop for another attempt.
  }
}

/** After reproduction is approved: run Workflow B, then wait for a decision on the fix. */
async function fixLoop(input: IncidentWorkflowInput, state: WorkflowState): Promise<string> {
  let regenerate: (Actor & { note: string | null }) | null = null;
  let rejected: (Actor & { reason: string }) | null = null;
  let prApproved: Actor | null = null;
  setHandler(regenerateFix, (s) => {
    regenerate ??= s;
  });
  setHandler(rejectFix, (s) => {
    rejected ??= s;
  });
  setHandler(approvePullRequest, (s) => {
    prApproved ??= s;
  });

  for (let version = 1; ; version++) {
    const outcome = await reproduceAndFix(input, state, version);
    state.phase = 'awaiting_fix_decision';
    await condition(
      () =>
        regenerate !== null ||
        rejected !== null ||
        (prApproved !== null && outcome === 'validated'),
    );
    if (rejected) {
      await evidence.closeIncident({
        ...input,
        actorId: (rejected as Actor).actorId,
        reason: (rejected as { reason: string }).reason,
      });
      state.phase = 'fix_rejected';
      return 'fix_rejected';
    }
    if (prApproved && outcome === 'validated') {
      // Phase 6 creates the pull request from here.
      state.phase = 'pr_approved';
      return 'pr_approved';
    }
    regenerate = null; // "Regenerate": try again with a new fix version
  }
}
