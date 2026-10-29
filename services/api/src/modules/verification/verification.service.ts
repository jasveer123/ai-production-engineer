import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { IncidentVerification, VerificationRunView } from '@ape/api-contracts';
import { notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { deployments, incidents, pullRequests, verificationRuns } from '../../core/db/schema';
import { TemporalService } from '../../core/temporal/temporal.service';

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly temporal: TemporalService,
  ) {}

  async forIncident(actor: ActorContext, incidentId: string): Promise<IncidentVerification> {
    const [inc] = await this.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.workspaceId, actor.workspaceId)));
    if (!inc) throw notFound('Incident');

    const rows = await this.db
      .select({ run: verificationRuns, deploy: deployments })
      .from(verificationRuns)
      .leftJoin(deployments, eq(deployments.id, verificationRuns.deploymentId))
      .where(
        and(
          eq(verificationRuns.incidentId, incidentId),
          eq(verificationRuns.workspaceId, actor.workspaceId),
        ),
      )
      .orderBy(desc(verificationRuns.createdAt), desc(verificationRuns.window));
    const state = await this.temporal.state(incidentId).catch(() => null);

    let awaitingDeploy: IncidentVerification['awaitingDeploy'] = null;
    if (state?.phase === 'awaiting_deploy') {
      const [pr] = await this.db
        .select({ number: pullRequests.number, sha: pullRequests.mergeCommitSha })
        .from(pullRequests)
        .where(
          and(
            eq(pullRequests.incidentId, incidentId),
            eq(pullRequests.workspaceId, actor.workspaceId),
            eq(pullRequests.status, 'merged'),
          ),
        )
        .orderBy(desc(pullRequests.mergedAt))
        .limit(1);
      awaitingDeploy = { prNumber: pr?.number ?? null, mergeCommitSha: pr?.sha ?? null };
    }

    return {
      runs: rows.map(({ run, deploy }): VerificationRunView => ({
        id: run.id,
        window: run.window,
        deployCommitSha: run.deployCommitSha,
        deployVersion: deploy?.version ?? null,
        deployedAt: deploy?.deployedAt.toISOString() ?? null,
        status: run.status as VerificationRunView['status'],
        outcome: run.outcome as VerificationRunView['outcome'],
        reason: run.reason,
        baseline: run.baseline ?? null,
        observed: run.observed ?? null,
        windowStartedAt: run.windowStartedAt?.toISOString() ?? null,
        windowEndedAt: run.windowEndedAt?.toISOString() ?? null,
      })),
      awaitingDeploy,
      phase: state?.phase ?? null,
    };
  }
}
