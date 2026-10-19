import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { FixActionInput, FixView, IncidentFixes } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { fixProposals, incidents, validationRuns } from '../db/schema';
import { TemporalService } from '../temporal/temporal.service';

@Injectable()
export class FixesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly artifacts: ArtifactStore,
    private readonly temporal: TemporalService,
    private readonly audit: AuditService,
  ) {}

  private async ensureIncident(actor: ActorContext, incidentId: string) {
    const [inc] = await this.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.workspaceId, actor.workspaceId)));
    if (!inc) throw notFound('Incident');
  }

  async forIncident(actor: ActorContext, incidentId: string): Promise<IncidentFixes> {
    await this.ensureIncident(actor, incidentId);
    const [latest] = await this.db
      .select()
      .from(fixProposals)
      .where(
        and(
          eq(fixProposals.incidentId, incidentId),
          eq(fixProposals.workspaceId, actor.workspaceId),
        ),
      )
      .orderBy(desc(fixProposals.createdAt))
      .limit(1);
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: count() })
      .from(fixProposals)
      .where(eq(fixProposals.incidentId, incidentId));
    const state = await this.temporal.state(incidentId).catch(() => null);
    return {
      latest: latest ? await this.view(latest) : null,
      versions: Number(n),
      phase: state?.phase ?? null,
    };
  }

  private async view(fix: typeof fixProposals.$inferSelect): Promise<FixView> {
    const runs = await this.db
      .select()
      .from(validationRuns)
      .where(eq(validationRuns.fixProposalId, fix.id))
      .orderBy(asc(validationRuns.createdAt));
    const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => fn().catch(() => null);
    const test = fix.testReference
      ? await safe(() => this.artifacts.getJson<{ content: string }>(fix.testReference!))
      : null;
    const diff = fix.patchReference
      ? await safe(() => this.artifacts.getText(fix.patchReference!))
      : null;
    return {
      id: fix.id,
      version: fix.version,
      status: fix.status,
      statusReason: fix.statusReason,
      repositoryFullName: fix.repositoryFullName,
      baseCommitSha: fix.baseCommitSha,
      testPath: fix.testPath,
      test: test?.content ?? null,
      testRationale: fix.testRationale,
      diff,
      explanation: fix.explanation,
      diffStat: fix.diffStat ?? null,
      patchAttempts: fix.patchAttempts,
      runs: runs.map((r) => ({
        id: r.id,
        kind: r.kind as FixView['runs'][number]['kind'],
        attempt: r.attempt,
        status: r.status as FixView['runs'][number]['status'],
        durationMs: r.durationMs,
        summary: r.summary,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: fix.createdAt.toISOString(),
    };
  }

  async act(
    actor: ActorContext,
    incidentId: string,
    input: FixActionInput,
  ): Promise<IncidentFixes> {
    await this.ensureIncident(actor, incidentId);
    const current = await this.forIncident(actor, incidentId);
    if (current.phase !== 'awaiting_fix_decision') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'not_awaiting_fix_decision',
        'Wait for the fix run to finish first',
      );
    }
    if (input.action === 'approve_pr' && current.latest?.status !== 'validated') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'fix_not_validated',
        'Only a validated fix can be approved',
      );
    }
    await this.temporal.fixDecision(incidentId, actor.userId, input.action, input.note ?? null);
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: `fix.${input.action}`,
      resourceType: 'fix_proposal',
      resourceId: current.latest?.id ?? null,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { note: input.note ?? null, patchHash: current.latest?.diff ? 'present' : null },
    });
    return this.forIncident(actor, incidentId);
  }
}
