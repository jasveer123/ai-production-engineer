import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type {
  ApplyPatchResult,
  FixActivities,
  IncidentWorkflowInput,
  PrepareFixResult,
  RunKind,
} from '@ape/temporal-workflows';
import { AuditService } from '../../../core/audit/audit.service';
import { ArtifactStore } from '../../../core/artifacts/artifact-store.service';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  fixProposals,
  incidentEvents,
  incidents,
  usageRecords,
  validationRuns,
  type IncidentStatus,
} from '../../../core/db/schema';
import { GitHubService } from '../../../connectors/github/github.service';
import { canTransition } from '../../incidents/domain/lifecycle';
import { type FixContext } from '../domain/fix-context';
import { PrepareFailed, FixPreparer } from '../application/fix-preparer.service';
import { applyEdits, type Edit } from '../domain/patch';

@Injectable()
export class FixActivitiesService implements FixActivities {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly artifacts: ArtifactStore,
    private readonly github: GitHubService,
    private readonly audit: AuditService,
    private readonly preparer: FixPreparer,
  ) {}

  async prepareFix(
    input: IncidentWorkflowInput & { runKey: string; version: number },
  ): Promise<PrepareFixResult> {
    try {
      return await this.preparer.prepare(input);
    } catch (err) {
      if (!(err instanceof PrepareFailed)) throw err;
      if (err.fixProposalId)
        await this.updateFix({
          fixProposalId: err.fixProposalId,
          status: 'error',
          reason: err.message,
        });
      return { ok: false, fixProposalId: err.fixProposalId, reason: err.message };
    }
  }

  async testOverlay({ fixProposalId, testRef }: { fixProposalId: string; testRef: string }) {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, fixProposalId));
    const test = await this.artifacts.getJson<{ path: string; content: string }>(testRef);
    const overlayRef = await this.artifacts.putJson(
      `fixes/${fix!.workspaceId}/${fixProposalId}/overlay-test.json`,
      {
        files: { [test.path]: test.content },
      },
    );
    return { overlayRef };
  }

  async applyPatch(input: {
    fixProposalId: string;
    attempt: number;
    patchRef: string;
    testRef: string;
  }): Promise<ApplyPatchResult> {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, input.fixProposalId));
    const ctxRef = `s3://${this.artifacts.bucket}/fixes/${fix!.workspaceId}/${fix!.id}/context.json`;
    const ctx = await this.artifacts.getJson<FixContext>(ctxRef);
    const patch = await this.artifacts.getJson<{ edits: Edit[]; explanation: string }>(
      input.patchRef,
    );
    const test = await this.artifacts.getJson<{ path: string; content: string }>(input.testRef);
    const outcome = applyEdits(ctx.editable, patch.edits);

    const base = `fixes/${fix!.workspaceId}/${fix!.id}/attempt-${input.attempt}`;
    if (!outcome.ok) {
      await this.recordRun({
        fixProposalId: fix!.id,
        kind: 'policy',
        attempt: input.attempt,
        image: 'policy-check',
        result: {
          status: 'failed',
          reason: 'policy_violation',
          summary: { violations: outcome.violations },
        },
      });
      return {
        ok: false,
        overlayRef: null,
        violations: outcome.violations,
        diffStat: outcome.diffStat,
      };
    }
    const diffRef = await this.artifacts.putText(`${base}/patch.diff`, outcome.diff, 'text/x-diff');
    const overlayRef = await this.artifacts.putJson(`${base}/overlay.json`, {
      files: { ...outcome.files, [test.path]: test.content },
    });
    await this.db
      .update(fixProposals)
      .set({
        patchReference: diffRef,
        patchHash: createHash('sha256').update(outcome.diff).digest('hex'),
        diffStat: outcome.diffStat,
        explanation: patch.explanation,
        patchAttempts: input.attempt,
        policyViolations: [],
      })
      .where(eq(fixProposals.id, fix!.id));
    await this.recordRun({
      fixProposalId: fix!.id,
      kind: 'policy',
      attempt: input.attempt,
      image: 'policy-check',
      result: { status: 'passed', reason: null, summary: { diffStat: outcome.diffStat } },
    });
    return { ok: true, overlayRef, violations: [], diffStat: outcome.diffStat };
  }

  async recordRun(input: {
    fixProposalId: string;
    kind: RunKind;
    attempt: number;
    image: string;
    result: {
      status: 'passed' | 'failed' | 'error' | 'skipped';
      reason: string | null;
      exitCode?: number | null;
      durationMs?: number;
      summary: Record<string, unknown>;
      outputRef?: string | null;
    };
  }): Promise<void> {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, input.fixProposalId));
    await this.db.insert(validationRuns).values({
      workspaceId: fix!.workspaceId,
      fixProposalId: input.fixProposalId,
      kind: input.kind,
      attempt: input.attempt,
      sandboxImage: input.image,
      status: input.result.status,
      exitCode: input.result.exitCode ?? null,
      durationMs: input.result.durationMs ?? null,
      summary: { ...input.result.summary, reason: input.result.reason },
      resultReference: input.result.outputRef ?? null,
    });
    if (input.result.durationMs) {
      await this.db.insert(usageRecords).values({
        workspaceId: fix!.workspaceId,
        metric: 'sandbox_seconds',
        quantity: String(input.result.durationMs / 1000),
      });
    }
  }

  async updateFix(input: Parameters<FixActivities['updateFix']>[0]): Promise<void> {
    const patch: Partial<typeof fixProposals.$inferInsert> = { status: input.status };
    if (input.reason !== undefined) patch.statusReason = input.reason;
    if (input.testRef) patch.testReference = input.testRef;
    if (input.testRationale) patch.testRationale = input.testRationale;
    if (input.explanation) patch.explanation = input.explanation;
    if (input.patchAttempts !== undefined) patch.patchAttempts = input.patchAttempts;
    const [fix] = await this.db
      .update(fixProposals)
      .set(patch)
      .where(eq(fixProposals.id, input.fixProposalId))
      .returning();
    if (
      fix &&
      [
        'validated',
        'validation_failed',
        'not_reproduced',
        'baseline_failed',
        'error',
        'rejected',
      ].includes(input.status)
    ) {
      await this.db.insert(incidentEvents).values({
        workspaceId: fix.workspaceId,
        incidentId: fix.incidentId!,
        kind: 'fix',
        source: 'sandbox',
        occurredAt: new Date(),
        summary: `Fix v${fix.version}: ${input.status.replace(/_/g, ' ')}${input.reason ? ` (${input.reason})` : ''}`,
        attributes: { fixProposalId: fix.id, status: input.status },
      });
      await this.audit.record({
        workspaceId: fix.workspaceId,
        actorType: 'agent',
        action: `fix.${input.status}`,
        resourceType: 'fix_proposal',
        resourceId: fix.id,
        outcome: input.status === 'error' ? 'failure' : 'success',
        correlationId: fix.workflowRunKey ?? fix.id,
        metadata: { reason: input.reason ?? null, attempts: fix.patchAttempts },
      });
    }
  }

  async setIncidentStatus(
    input: IncidentWorkflowInput & { to: string; summary: string },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [inc] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, input.incidentId))
        .for('update');
      const to = input.to as IncidentStatus;
      if (!inc || inc.status === to || !canTransition(inc.status, to)) return;
      await tx
        .update(incidents)
        .set({ status: to, version: inc.version + 1 })
        .where(eq(incidents.id, inc.id));
      await tx.insert(incidentEvents).values({
        workspaceId: inc.workspaceId,
        incidentId: inc.id,
        kind: 'status_change',
        source: 'workflow',
        occurredAt: new Date(),
        summary: `Status changed from ${inc.status} to ${to}. ${input.summary}`,
        attributes: { from: inc.status, to, reason: input.summary },
      });
    });
  }
}
