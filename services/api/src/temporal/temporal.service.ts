import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Client, Connection, WorkflowNotFoundError } from '@temporalio/client';
import {
  approvePullRequest,
  approveReproduction,
  regenerateFix,
  rejectFix,
  dismiss,
  incidentWorkflowId,
  requestMoreInvestigation,
  stateQuery,
  TASK_QUEUES,
  type IncidentWorkflowInput,
} from '@ape/temporal-workflows';
import { ENV, type ApiEnv } from '../config/config.module';

/** Thin wrapper over the Temporal client. Connects lazily so the API starts without Temporal. */
@Injectable()
export class TemporalService implements OnApplicationShutdown {
  private client?: Promise<Client>;
  private connection?: Connection;

  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  private async getClient(): Promise<Client> {
    this.client ??= Connection.connect({ address: this.env.TEMPORAL_ADDRESS }).then((c) => {
      this.connection = c;
      return new Client({ connection: c, namespace: this.env.TEMPORAL_NAMESPACE });
    });
    return this.client;
  }

  async onApplicationShutdown() {
    await this.connection?.close();
  }

  /** Starts the incident workflow; a second start for the same incident is a no-op. */
  async startIncidentWorkflow(
    input: IncidentWorkflowInput,
  ): Promise<'started' | 'already_running'> {
    const client = await this.getClient();
    try {
      await client.workflow.start('incidentWorkflow', {
        workflowId: incidentWorkflowId(input.incidentId),
        taskQueue: TASK_QUEUES.incident,
        args: [input],
        workflowIdConflictPolicy: 'USE_EXISTING',
      });
      return 'started';
    } catch (err) {
      if ((err as Error).name === 'WorkflowExecutionAlreadyStartedError') return 'already_running';
      throw err;
    }
  }

  /** Live phase from the workflow query, or the final status (e.g. completed) once it has ended. */
  async state(
    incidentId: string,
  ): Promise<{ phase: string; attempt: number; running: boolean } | null> {
    const client = await this.getClient();
    const handle = client.workflow.getHandle(incidentWorkflowId(incidentId));
    try {
      const desc = await handle.describe();
      const running = desc.status.name === 'RUNNING';
      const state = running ? await handle.query(stateQuery) : null;
      return {
        phase: state?.phase ?? desc.status.name.toLowerCase(),
        attempt: state?.attempt ?? 0,
        running,
      };
    } catch (err) {
      if (err instanceof WorkflowNotFoundError) return null;
      throw err;
    }
  }

  /** "Investigate further": signal a running workflow, or start a new run if it has finished. */
  async requestInvestigation(input: IncidentWorkflowInput, actorId: string, note: string | null) {
    const client = await this.getClient();
    await client.workflow.signalWithStart('incidentWorkflow', {
      workflowId: incidentWorkflowId(input.incidentId),
      taskQueue: TASK_QUEUES.incident,
      args: [input],
      signal: requestMoreInvestigation,
      signalArgs: [{ actorId, note }],
    });
  }

  async approveReproduction(incidentId: string, actorId: string) {
    const client = await this.getClient();
    await client.workflow
      .getHandle(incidentWorkflowId(incidentId))
      .signal(approveReproduction, { actorId });
  }

  async fixDecision(
    incidentId: string,
    actorId: string,
    action: 'regenerate' | 'reject' | 'approve_pr',
    note: string | null,
  ) {
    const handle = (await this.getClient()).workflow.getHandle(incidentWorkflowId(incidentId));
    if (action === 'regenerate') await handle.signal(regenerateFix, { actorId, note });
    else if (action === 'reject')
      await handle.signal(rejectFix, { actorId, reason: note || 'Fix rejected by reviewer' });
    else await handle.signal(approvePullRequest, { actorId });
  }

  async dismiss(incidentId: string, actorId: string, reason: string) {
    const client = await this.getClient();
    await client.workflow
      .getHandle(incidentWorkflowId(incidentId))
      .signal(dismiss, { actorId, reason });
  }
}
