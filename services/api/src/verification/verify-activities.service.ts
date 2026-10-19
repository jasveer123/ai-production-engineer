import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';
import type {
  EvaluateVerificationResult,
  FixDeployResult,
  IncidentWorkflowInput,
  MonitoringPlan,
  RecoveryOutcome,
  StartVerificationResult,
  VerifyActivities,
} from '@ape/temporal-workflows';
import { AuditService } from '../audit/audit.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  deployments,
  incidentEvents,
  incidents,
  integrations,
  pullRequests,
  services,
  verificationRuns,
  type IncidentStatus,
  type VerificationBaseline,
  type VerificationObserved,
} from '../db/schema';
import { GitHubService } from '../github/github.service';
import { canTransition } from '../incidents/lifecycle';
import { JaegerPoller } from '../ingestion/jaeger.poller';
import {
  decideRecovery,
  DEFAULT_MIN_EXPECTED_ERRORS,
  expectedErrors,
  sameCommit,
} from './recovery';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type IncidentRow = typeof incidents.$inferSelect;

/** Statuses verification may act on. Anything else means a human (or a recurrence) took over. */
const VERIFYING: IncidentStatus[] = ['monitoring', 'verification_inconclusive'];
const BASELINE_LOOKBACK_MS = 24 * 60 * 60_000;
/** Deploy timestamps come from the sender's clock; tolerate some skew around the merge time. */
const MERGE_SKEW_MS = 10 * 60_000;
const MAX_DEPLOY_CANDIDATES = 10;

const RESULT_STATUS: Record<RecoveryOutcome, IncidentStatus> = {
  recovered: 'resolved',
  not_recovered: 'needs_attention',
  inconclusive: 'verification_inconclusive',
};

const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`;

/**
 * Phase 7 activities (ADR-019): find the deploy that contains the merged fix, then compare the
 * incident's own error fingerprint after it with the rate before it. Read-only towards GitHub
 * and Jaeger; the only writes are verification rows, timeline events and the incident status.
 */
@Injectable()
export class VerifyActivitiesService implements VerifyActivities {
  private readonly logger = new Logger(VerifyActivitiesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly github: GitHubService,
    private readonly jaeger: JaegerPoller,
    private readonly audit: AuditService,
  ) {}

  async beginMonitoring(
    input: IncidentWorkflowInput & { mergeCommitSha: string | null; prNumber: number },
  ): Promise<MonitoringPlan> {
    const sha = input.mergeCommitSha?.slice(0, 7);
    await this.event(
      input,
      sha
        ? `Pull request #${input.prNumber} merged as ${sha}. Waiting for a deploy that contains it.`
        : `Pull request #${input.prNumber} merged. Waiting for the next deploy.`,
      { mergeCommitSha: input.mergeCommitSha, prNumber: input.prNumber },
    );
    return {
      deployWaitMs: this.env.VERIFY_DEPLOY_WAIT_MS,
      deployPollMs: this.env.VERIFY_DEPLOY_POLL_MS,
      maxWindows: this.env.VERIFY_MAX_WINDOWS,
    };
  }

  async findFixDeploy(
    input: IncidentWorkflowInput & { mergeCommitSha: string | null },
  ): Promise<FixDeployResult> {
    const incident = await this.incident(input.incidentId);
    if (!incident || !VERIFYING.includes(incident.status)) return { status: 'superseded' };
    if (!incident.serviceName || !incident.environment) return { status: 'not_yet' };

    const [pr] = await this.db
      .select({ mergedAt: pullRequests.mergedAt, repo: pullRequests.repositoryFullName })
      .from(pullRequests)
      .where(and(eq(pullRequests.incidentId, incident.id), eq(pullRequests.status, 'merged')))
      .orderBy(desc(pullRequests.mergedAt))
      .limit(1);
    const since = new Date((pr?.mergedAt ?? incident.createdAt).getTime() - MERGE_SKEW_MS);
    const candidates = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, input.workspaceId),
          eq(deployments.serviceName, incident.serviceName),
          eq(deployments.environment, incident.environment),
          gte(deployments.deployedAt, since),
          ne(deployments.commitSha, 'unknown'),
        ),
      )
      .orderBy(asc(deployments.deployedAt))
      .limit(MAX_DEPLOY_CANDIDATES);

    const merge = input.mergeCommitSha;
    const repo = pr?.repo ?? (await this.repositoryOf(incident));
    const installationId = repo ? await this.github.installationFor(input.workspaceId, repo) : null;
    for (const d of candidates) {
      // Without a merge sha (should not happen for merged PRs) the first later deploy counts.
      let contains = !merge || sameCommit(d.commitSha, merge);
      if (!contains && merge && repo && installationId) {
        try {
          contains = await this.github.gh().contains(installationId, repo, d.commitSha, merge);
        } catch (err) {
          // GitHub down or the deployed commit is unknown to it: try again on the next poll.
          this.logger.warn(`Compare ${merge}...${d.commitSha} failed: ${(err as Error).message}`);
        }
      }
      if (contains) {
        return {
          status: 'found',
          deploymentId: d.id,
          commitSha: d.commitSha,
          deployedAt: d.deployedAt.toISOString(),
        };
      }
    }
    return { status: 'not_yet' };
  }

  async startVerification(
    input: IncidentWorkflowInput & { deploymentId: string; window: number },
  ): Promise<StartVerificationResult> {
    const incident = (await this.incident(input.incidentId))!;
    const [deploy] = await this.db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.deploymentId));
    const deployedAt = deploy!.deployedAt.getTime();
    const windowStart = new Date(deployedAt + this.env.VERIFY_GRACE_MS);
    const windowEnd = new Date(windowStart.getTime() + input.window * this.env.VERIFY_WINDOW_MS);

    const inserted = await this.db
      .insert(verificationRuns)
      .values({
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        deploymentId: deploy!.id,
        window: input.window,
        deployCommitSha: deploy!.commitSha,
        baseline: await this.baseline(incident, deploy!.deployedAt),
        windowStartedAt: windowStart,
        windowEndedAt: windowEnd,
      })
      .onConflictDoNothing()
      .returning({ id: verificationRuns.id });
    const [run] = inserted.length
      ? inserted
      : await this.db
          .select({ id: verificationRuns.id })
          .from(verificationRuns)
          .where(
            and(
              eq(verificationRuns.incidentId, input.incidentId),
              eq(verificationRuns.deploymentId, deploy!.id),
              eq(verificationRuns.window, input.window),
            ),
          );
    if (inserted.length) {
      const total = minutes(windowEnd.getTime() - windowStart.getTime());
      await this.event(
        input,
        input.window === 1
          ? `Fix deployed (${deploy!.version ?? deploy!.commitSha.slice(0, 7)}). Watching for the same error for ${total}.`
          : `Not conclusive yet. Extending the observation to ${total} after the deploy.`,
        { verificationRunId: run!.id, deploymentId: deploy!.id, window: input.window },
      );
    }
    return {
      verificationRunId: run!.id,
      waitMs: Math.max(0, windowEnd.getTime() + this.env.VERIFY_SETTLE_MS - Date.now()),
      checkEveryMs: this.env.VERIFY_CHECK_EVERY_MS,
    };
  }

  async evaluateVerification(input: {
    verificationRunId: string;
    interim: boolean;
    finalWindow: boolean;
  }): Promise<EvaluateVerificationResult> {
    const [run] = await this.db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.id, input.verificationRunId));
    if (!run) throw new Error(`Verification run ${input.verificationRunId} not found`);
    if (run.status === 'completed') {
      // Activity retry after the result was stored: report the same result again.
      return {
        outcome: (run.outcome as RecoveryOutcome) ?? 'inconclusive',
        reason: run.reason ?? '',
        superseded: run.reason?.startsWith('Superseded') ?? false,
      };
    }
    const incident = (await this.incident(run.incidentId))!;
    if (!VERIFYING.includes(incident.status)) {
      const reason = `Superseded: the incident was moved to ${incident.status.replace(/_/g, ' ')}`;
      await this.db
        .update(verificationRuns)
        .set({ status: 'completed', outcome: 'inconclusive', reason })
        .where(eq(verificationRuns.id, run.id));
      return { outcome: 'inconclusive', reason, superseded: true };
    }

    const start = run.windowStartedAt!;
    const end = input.interim
      ? new Date(Math.min(Date.now(), run.windowEndedAt!.getTime()))
      : run.windowEndedAt!;
    const observed = await this.observe(incident, start, end, run.baseline!, !input.interim);
    const decision = decideRecovery(
      {
        errors: observed.errors,
        requests: observed.requests,
        expectedErrors: observed.expectedErrors,
        interim: input.interim,
      },
      {
        minErrors: this.env.VERIFY_MIN_ERRORS,
        minRequests: this.env.VERIFY_MIN_REQUESTS,
        minExpectedErrors: DEFAULT_MIN_EXPECTED_ERRORS,
      },
    );
    if (decision.outcome === 'pending') {
      await this.db
        .update(verificationRuns)
        .set({ observed, reason: decision.reason })
        .where(eq(verificationRuns.id, run.id));
      return { ...decision, superseded: false };
    }

    const outcome = decision.outcome;
    const concludes = outcome !== 'inconclusive' || input.finalWindow;
    let reason = decision.reason;
    if (outcome === 'not_recovered') reason += await this.rollbackHint(run.deploymentId);

    const superseded = await this.db.transaction(async (tx) => {
      const [inc] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, incident.id))
        .for('update');
      if (!inc || !VERIFYING.includes(inc.status)) return true;
      await tx
        .update(verificationRuns)
        .set({ status: 'completed', outcome, reason, observed })
        .where(eq(verificationRuns.id, run.id));
      if (!concludes) return false; // the workflow opens the next, longer window
      const to = RESULT_STATUS[outcome];
      await this.move(tx, inc, to, reason);
      await this.audit.record(
        {
          workspaceId: inc.workspaceId,
          actorType: 'system',
          action: `verification.${outcome}`,
          resourceType: 'incident',
          resourceId: inc.id,
          outcome: 'success',
          correlationId: `verify-${run.id}`,
          metadata: { verificationRunId: run.id, window: run.window, observed },
        },
        tx,
      );
      return false;
    });
    return { outcome, reason, superseded };
  }

  async noFixDeploy(input: IncidentWorkflowInput & { waitedMs: number }): Promise<void> {
    const days = Math.round(input.waitedMs / 86_400_000);
    const reason = `No deploy containing the fix was seen within ${days >= 1 ? `${days} day(s)` : minutes(input.waitedMs)}. Recovery could not be verified.`;
    await this.db.transaction(async (tx) => {
      const [inc] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, input.incidentId))
        .for('update');
      if (inc?.status === 'monitoring')
        await this.move(tx, inc, 'verification_inconclusive', reason);
    });
  }

  // ----- helpers -----

  private async incident(id: string): Promise<IncidentRow | undefined> {
    const [row] = await this.db.select().from(incidents).where(eq(incidents.id, id));
    return row;
  }

  private async repositoryOf(incident: IncidentRow): Promise<string | null> {
    if (!incident.serviceId) return null;
    const [svc] = await this.db
      .select({ repo: services.repositoryFullName })
      .from(services)
      .where(eq(services.id, incident.serviceId));
    return svc?.repo ?? null;
  }

  private async errorCount(incidentId: string, from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(incidentEvents)
      .where(
        and(
          eq(incidentEvents.incidentId, incidentId),
          eq(incidentEvents.kind, 'error'),
          gte(incidentEvents.occurredAt, from),
          lt(incidentEvents.occurredAt, to),
        ),
      );
    return Number(row?.n ?? 0);
  }

  /** Error rate of the incident's fingerprint before the fix (up to 24 h back). */
  private async baseline(incident: IncidentRow, deployedAt: Date): Promise<VerificationBaseline> {
    const from = new Date(
      Math.max(incident.firstSeenAt.getTime(), deployedAt.getTime() - BASELINE_LOOKBACK_MS),
    );
    const durationMs = Math.max(60_000, deployedAt.getTime() - from.getTime());
    const errors = await this.errorCount(incident.id, from, deployedAt);
    return {
      errors,
      durationMs,
      errorsPerHour: Math.round((errors / durationMs) * 3_600_000 * 100) / 100,
    };
  }

  private async observe(
    incident: IncidentRow,
    start: Date,
    end: Date,
    baseline: VerificationBaseline,
    withTraffic: boolean,
  ): Promise<VerificationObserved> {
    const durationMs = Math.max(0, end.getTime() - start.getTime());
    const errors = await this.errorCount(incident.id, start, end);
    const operation = await this.failingOperation(incident.id);
    const requests =
      withTraffic && operation ? await this.traffic(incident, operation, start, end) : null;
    return {
      errors,
      durationMs,
      requests,
      operation,
      expectedErrors: expectedErrors(baseline.errorsPerHour, durationMs),
    };
  }

  /** The server operation the errors came from, e.g. "POST /checkout". */
  private async failingOperation(incidentId: string): Promise<string | null> {
    const [e] = await this.db
      .select({ attributes: incidentEvents.attributes })
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'error')))
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(1);
    const op = e?.attributes.operation;
    return typeof op === 'string' && op ? op : null;
  }

  /** Request count from Jaeger, or null when no Jaeger integration is connected or it fails. */
  private async traffic(
    incident: IncidentRow,
    operation: string,
    start: Date,
    end: Date,
  ): Promise<number | null> {
    const [jaeger] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, incident.workspaceId),
          eq(integrations.provider, 'otel_jaeger'),
          inArray(integrations.status, ['connected', 'error']),
        ),
      )
      .limit(1);
    if (!jaeger || !incident.serviceName) return null;
    try {
      return await this.jaeger.client.traceCount(
        incident.serviceName,
        operation,
        start.getTime() * 1000,
        end.getTime() * 1000,
      );
    } catch (err) {
      this.logger.warn(`Traffic count for ${operation} failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Names the deploy before the fix as a rollback candidate. A human decides (ADR-008). */
  private async rollbackHint(deploymentId: string | null): Promise<string> {
    if (!deploymentId) return '';
    const [fix] = await this.db.select().from(deployments).where(eq(deployments.id, deploymentId));
    if (!fix) return '';
    const [prev] = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, fix.workspaceId),
          eq(deployments.serviceName, fix.serviceName),
          eq(deployments.environment, fix.environment),
          lte(deployments.deployedAt, fix.deployedAt),
          ne(deployments.id, fix.id),
        ),
      )
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    return prev
      ? `. The previous deploy was ${prev.version ?? prev.commitSha.slice(0, 7)} (${prev.commitSha.slice(0, 7)}); consider rolling back or investigating again.`
      : '. Consider investigating again.';
  }

  private async move(tx: Tx, inc: IncidentRow, to: IncidentStatus, reason: string) {
    if (inc.status === to || !canTransition(inc.status, to)) return;
    await tx
      .update(incidents)
      .set({ status: to, version: inc.version + 1 })
      .where(eq(incidents.id, inc.id));
    await tx.insert(incidentEvents).values({
      workspaceId: inc.workspaceId,
      incidentId: inc.id,
      kind: 'status_change',
      source: 'verification',
      occurredAt: new Date(),
      summary: `Status changed from ${inc.status} to ${to}. ${reason}`,
      attributes: { from: inc.status, to, reason },
    });
  }

  private async event(
    input: IncidentWorkflowInput,
    summary: string,
    attributes: Record<string, unknown>,
  ) {
    await this.db.insert(incidentEvents).values({
      workspaceId: input.workspaceId,
      incidentId: input.incidentId,
      kind: 'verification',
      source: 'verification',
      occurredAt: new Date(),
      summary,
      attributes,
    });
  }
}
