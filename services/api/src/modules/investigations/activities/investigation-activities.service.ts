import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type {
  CollectEvidenceResult,
  EvidenceActivities,
  IncidentWorkflowInput,
  InvestigateResult,
  StartInvestigationInput,
} from '@ape/temporal-workflows';
import { AuditService } from '../../../core/audit/audit.service';
import { ArtifactStore } from '../../../core/artifacts/artifact-store.service';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  approvals,
  evidenceItems,
  hypotheses,
  incidentEvents,
  incidents,
  investigations,
  services,
  usageRecords,
} from '../../../core/db/schema';
import { UsageService } from '../../usage/usage.service';
import { EvidenceCollector } from '../application/evidence-collector.service';
import { transitionIncident } from '../infrastructure/incident-transition';
import {
  acceptCitations,
  CONFIDENCE,
  evidenceBundle,
  modelUsageRows,
  reportOutcome,
  type StoredReport,
} from '../domain/investigation-report';

interface SaveReport {
  inv: typeof investigations.$inferSelect;
  report: StoredReport | null;
  result: InvestigateResult;
  byRef: Map<string, string>;
  hyps: ReturnType<typeof acceptCitations>['hyps'];
  observations: ReturnType<typeof acceptCitations>['observations'];
  status: 'completed' | 'needs_review';
  reason: string | null;
}

const BLOCKED = 'usage_limit: ';

@Injectable()
export class InvestigationActivities implements EvidenceActivities {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly collector: EvidenceCollector,
    private readonly artifacts: ArtifactStore,
    private readonly audit: AuditService,
    private readonly usage: UsageService,
  ) {}

  async startInvestigation(
    input: StartInvestigationInput,
  ): Promise<{ investigationId: string; blocked?: string }> {
    const runKey = `${input.workflowId}:${input.runId}`;
    return this.db.transaction(async (tx) => {
      const done = await this.findAttempt(tx, runKey, input.attempt);
      if (done) {
        const blocked = done.status === 'failed' && done.reason?.startsWith(BLOCKED);
        return blocked
          ? { investigationId: done.id, blocked: done.reason!.slice(BLOCKED.length) }
          : { investigationId: done.id };
      }

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.workspaceId}))`);
      const blocked = await this.usage.blockedReason(input.workspaceId, tx);
      if (blocked) return this.recordBlockedStart(tx, input, runKey, blocked);
      const inserted = await tx
        .insert(investigations)
        .values({
          workspaceId: input.workspaceId,
          incidentId: input.incidentId,
          workflowId: runKey,
          attempt: input.attempt,
          status: 'collecting_evidence',
          requestNote: input.note,
          startedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: investigations.id });
      if (inserted[0]) {
        await transitionIncident(tx, this.audit, {
          incidentId: input.incidentId,
          to: 'investigating',
          summary: 'AI investigation started',
          actorId: null,
          correlationId: runKey,
        });
        return { investigationId: inserted[0].id };
      }
      const existing = await this.findAttempt(tx, runKey, input.attempt);
      return { investigationId: existing!.id };
    });
  }

  private async findAttempt(tx: Tx, runKey: string, attempt: number) {
    const [row] = await tx
      .select({
        id: investigations.id,
        status: investigations.status,
        reason: investigations.statusReason,
      })
      .from(investigations)
      .where(and(eq(investigations.workflowId, runKey), eq(investigations.attempt, attempt)));
    return row;
  }

  private async recordBlockedStart(
    tx: Tx,
    input: StartInvestigationInput,
    runKey: string,
    blocked: string,
  ) {
    const [row] = await tx
      .insert(investigations)
      .values({
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        workflowId: runKey,
        attempt: input.attempt,
        status: 'failed',
        statusReason: `${BLOCKED}${blocked}`,
        requestNote: input.note,
        completedAt: new Date(),
      })
      .returning({ id: investigations.id });
    await this.usage.recordBlocked(
      {
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        reason: blocked,
        actorId: null,
        correlationId: runKey,
      },
      tx,
    );
    return { investigationId: row!.id, blocked };
  }

  async collectEvidence({
    investigationId,
  }: {
    investigationId: string;
  }): Promise<CollectEvidenceResult> {
    const [inv] = await this.db
      .select()
      .from(investigations)
      .where(eq(investigations.id, investigationId));
    if (!inv) throw new Error(`Investigation ${investigationId} not found`);
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(eq(incidents.id, inv.incidentId));
    const [service] = incident?.serviceId
      ? await this.db.select().from(services).where(eq(services.id, incident.serviceId))
      : [];
    const collected = await this.collector.collect(inv.incidentId, inv.workspaceId);

    const rows = await this.db.transaction(async (tx) => {
      await tx.delete(evidenceItems).where(eq(evidenceItems.investigationId, investigationId));
      if (collected.items.length === 0) return [];
      return tx
        .insert(evidenceItems)
        .values(
          collected.items.map((item, i) => ({
            workspaceId: inv.workspaceId,
            investigationId,
            ref: `E${i + 1}`,
            kind: item.kind,
            title: item.title,
            sourceReference: item.sourceReference,
            sourceUrl: item.sourceUrl,
            contentHash: item.contentHash,
          })),
        )
        .returning();
    });

    const bundle = evidenceBundle({
      investigationId,
      incident: incident!,
      service,
      note: inv.requestNote,
      collected,
      rows,
    });
    const bundleRef = await this.artifacts.putJson(
      `evidence/${inv.workspaceId}/${investigationId}/bundle.json`,
      bundle,
    );
    await this.db
      .update(evidenceItems)
      .set({ artifactReference: bundleRef })
      .where(eq(evidenceItems.investigationId, investigationId));
    await this.db
      .update(investigations)
      .set({ status: 'analyzing', evidenceBundleRef: bundleRef, coverage: collected.coverage })
      .where(eq(investigations.id, investigationId));
    return { bundleRef, evidenceCount: rows.length };
  }

  async publishReport({
    investigationId,
    result,
  }: {
    investigationId: string;
    result: InvestigateResult;
  }): Promise<void> {
    const [inv] = await this.db
      .select()
      .from(investigations)
      .where(eq(investigations.id, investigationId));
    if (!inv) throw new Error(`Investigation ${investigationId} not found`);
    if (inv.completedAt) return;

    const report = result.reportRef
      ? await this.artifacts.getJson<StoredReport>(result.reportRef)
      : null;
    const items = await this.db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.investigationId, investigationId));
    const byRef = new Map(items.map((e) => [e.ref, e.id]));
    const { hyps, observations } = acceptCitations(report, byRef);
    const { status, reason } = reportOutcome(result, hyps.length);

    const published = { inv, report, status, reason };
    await this.db.transaction(async (tx) => {
      await this.saveReport(tx, { ...published, result, byRef, hyps, observations });
      await this.recordPublished(tx, { ...published, hypothesisCount: hyps.length });
    });
  }

  private async saveReport(tx: Tx, p: SaveReport): Promise<void> {
    const { inv, report, result, byRef } = p;
    await tx.delete(hypotheses).where(eq(hypotheses.investigationId, inv.id));
    if (p.hyps.length > 0) {
      await tx.insert(hypotheses).values(
        p.hyps.map((h, i) => ({
          workspaceId: inv.workspaceId,
          investigationId: inv.id,
          rank: i + 1,
          summary: h.summary,
          confidence: CONFIDENCE[h.confidence],
          confidenceLabel: h.confidence,
          confidenceRationale: h.confidence_rationale,
          supportingEvidenceIds: h.supporting_evidence.map((r) => byRef.get(r)!),
          contradictingEvidenceIds: h.contradicting_evidence.map((r) => byRef.get(r)!),
          missingInformation: h.missing_information,
          suspectedLocation: h.suspected_location,
        })),
      );
    }
    await tx
      .update(investigations)
      .set({
        status: p.status,
        statusReason: p.reason,
        model: report?.model ?? result.model,
        promptVersion: report?.prompt_version ?? null,
        reportRef: result.reportRef,
        observations: p.observations,
        dataGaps: report?.data_gaps ?? [],
        rejected: report?.rejected ?? [],
        usage: report?.usage ?? {},
        completedAt: new Date(),
      })
      .where(eq(investigations.id, inv.id));
    if (report && report.usage.calls > 0)
      await tx.insert(usageRecords).values(modelUsageRows(inv.workspaceId, report.usage));
  }

  private async recordPublished(
    tx: Tx,
    p: {
      inv: typeof investigations.$inferSelect;
      report: StoredReport | null;
      status: string;
      reason: string | null;
      hypothesisCount: number;
    },
  ): Promise<void> {
    const { inv, report, status, reason } = p;
    await tx.insert(incidentEvents).values({
      workspaceId: inv.workspaceId,
      incidentId: inv.incidentId,
      kind: 'investigation',
      source: 'ai',
      occurredAt: new Date(),
      summary:
        status === 'completed'
          ? `AI investigation #${inv.attempt} finished with ${p.hypothesisCount} hypothesis(es)`
          : `AI investigation #${inv.attempt} needs review: ${reason}`,
      attributes: { investigationId: inv.id, status, model: report?.model ?? null },
    });
    await this.audit.record(
      {
        workspaceId: inv.workspaceId,
        actorType: 'agent',
        action: 'investigation.completed',
        resourceType: 'investigation',
        resourceId: inv.id,
        outcome: 'success',
        correlationId: inv.workflowId,
        metadata: {
          status,
          reason,
          hypotheses: p.hypothesisCount,
          model: report?.model ?? null,
          cost_usd: report?.usage.cost_usd ?? 0,
        },
      },
      tx,
    );
  }

  async markInvestigation(input: {
    investigationId: string;
    status: 'failed' | 'cancelled';
    reason: string;
  }) {
    const [inv] = await this.db
      .update(investigations)
      .set({
        status: input.status,
        statusReason: input.reason.slice(0, 1000),
        completedAt: new Date(),
      })
      .where(
        and(
          eq(investigations.id, input.investigationId),
          inArray(investigations.status, ['collecting_evidence', 'analyzing']),
        ),
      )
      .returning();
    if (!inv) return;
    await this.db.insert(incidentEvents).values({
      workspaceId: inv.workspaceId,
      incidentId: inv.incidentId,
      kind: 'investigation',
      source: 'ai',
      occurredAt: new Date(),
      summary: `AI investigation #${inv.attempt} ${input.status}: ${input.reason.slice(0, 300)}`,
      attributes: { investigationId: inv.id, status: input.status },
    });
  }

  async closeIncident(
    input: IncidentWorkflowInput & { actorId: string; reason: string },
  ): Promise<void> {
    await this.db.transaction((tx) =>
      transitionIncident(tx, this.audit, {
        incidentId: input.incidentId,
        to: 'closed_without_fix',
        summary: input.reason,
        actorId: input.actorId,
        correlationId: `incident-${input.incidentId}`,
      }),
    );
  }

  async recordReproductionApproval(
    input: IncidentWorkflowInput & { actorId: string },
  ): Promise<void> {
    const existing = await this.db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(eq(approvals.resourceType, 'reproduction'), eq(approvals.resourceId, input.incidentId)),
      );
    if (existing.length > 0) return;
    await this.db.insert(approvals).values({
      workspaceId: input.workspaceId,
      resourceType: 'reproduction',
      resourceId: input.incidentId,
      actorId: input.actorId,
      decision: 'approved',
      policyVersion: 'v1',
    });
    await this.db.insert(incidentEvents).values({
      workspaceId: input.workspaceId,
      incidentId: input.incidentId,
      kind: 'status_change',
      source: 'user',
      occurredAt: new Date(),
      actorId: input.actorId,
      summary: 'Reproduction approved. The sandbox stage (Phase 5) picks up from here.',
      attributes: { approval: 'reproduction' },
    });
  }
}
