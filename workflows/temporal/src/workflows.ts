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
  PROMPT_VERSION,
  TASK_QUEUES,
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
      return 'reproduction_approved';
    }
    // Otherwise "Investigate further": loop for another attempt.
  }
}
