import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type {
  CollectEvidenceResult,
  EvidenceActivities,
  IncidentWorkflowInput,
  InvestigateResult,
  StartInvestigationInput,
} from '@ape/temporal-workflows';
import { AuditService } from '../audit/audit.service';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  approvals,
  evidenceItems,
  hypotheses,
  incidentEvents,
  incidents,
  investigations,
  services,
  usageRecords,
  type IncidentStatus,
} from '../db/schema';
import { canTransition } from '../incidents/lifecycle';
import { UsageService } from '../usage/usage.service';
import { EvidenceCollector } from './evidence-collector.service';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Report written by the Python AI worker (see services/ai-worker/src/ai_worker/report.py). */
interface StoredReport {
  status: 'completed' | 'needs_review';
  reason: string | null;
  model: string | null;
  prompt_version: string;
  observations: { statement: string; evidence: string[] }[];
  hypotheses: {
    rank: number;
    summary: string;
    confidence: 'high' | 'medium' | 'low';
    confidence_rationale: string;
    supporting_evidence: string[];
    contradicting_evidence: string[];
    missing_information: string[];
    suspected_location: { file: string; line: number | null; symbol: string | null } | null;
  }[];
  data_gaps: string[];
  rejected: { kind: string; text: string; reason: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    latency_ms: number;
    calls: number;
  };
}

/** statusReason prefix of a start the usage limits blocked. */
const BLOCKED = 'usage_limit: ';

const CONFIDENCE = { high: '0.80', medium: '0.50', low: '0.20' } as const;

/**
 * Temporal activities on the `evidence` queue. Each one is idempotent: Temporal may run it more
 * than once (retries, worker crash after completion), so every write checks or replaces state.
 */
@Injectable()
export class InvestigationActivities implements EvidenceActivities {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly collector: EvidenceCollector,
    private readonly artifacts: ArtifactStore,
    private readonly audit: AuditService,
    private readonly usage: UsageService,
  ) {}

  /** Moves the incident along the lifecycle if allowed, recording history like a user change. */
  private async transitionIncident(
    tx: Tx,
    incidentId: string,
    to: IncidentStatus,
    summary: string,
    actor: { actorId: string | null; correlationId: string },
  ): Promise<void> {
    const [inc] = await tx
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .for('update');
    if (!inc || !canTransition(inc.status, to)) return;
    await tx
      .update(incidents)
      .set({ status: to, version: inc.version + 1 })
      .where(eq(incidents.id, incidentId));
    await tx.insert(incidentEvents).values({
      workspaceId: inc.workspaceId,
      incidentId,
      kind: 'status_change',
      source: actor.actorId ? 'user' : 'workflow',
      occurredAt: new Date(),
      actorId: actor.actorId,
      summary: `Status changed from ${inc.status} to ${to}. ${summary}`.trim(),
      attributes: { from: inc.status, to, reason: summary },
    });
    await this.audit.record(
      {
        workspaceId: inc.workspaceId,
        actorId: actor.actorId,
        actorType: actor.actorId ? 'user' : 'agent',
        action: 'incident.status_changed',
        resourceType: 'incident',
        resourceId: incidentId,
        outcome: 'success',
        correlationId: actor.correlationId,
        metadata: { from: inc.status, to, reason: summary },
      },
      tx,
    );
  }

  async startInvestigation(
    input: StartInvestigationInput,
  ): Promise<{ investigationId: string; blocked?: string }> {
    const runKey = `${input.workflowId}:${input.runId}`;
    return this.db.transaction(async (tx) => {
      const [done] = await tx
        .select({
          id: investigations.id,
          status: investigations.status,
          reason: investigations.statusReason,
        })
        .from(investigations)
        .where(
          and(eq(investigations.workflowId, runKey), eq(investigations.attempt, input.attempt)),
        );
      if (done) {
        const blocked = done.status === 'failed' && done.reason?.startsWith(BLOCKED);
        return blocked
          ? { investigationId: done.id, blocked: done.reason!.slice(BLOCKED.length) }
          : { investigationId: done.id };
      }
      // FR-16: one start at a time per workspace, so two starts cannot both pass the limits.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.workspaceId}))`);
      const blocked = await this.usage.blockedReason(input.workspaceId, tx);
      if (blocked) {
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
        await this.transitionIncident(
          tx,
          input.incidentId,
          'investigating',
          'AI investigation started',
          {
            actorId: null,
            correlationId: runKey,
          },
        );
        return { investigationId: inserted[0].id };
      }
      const [existing] = await tx
        .select({ id: investigations.id })
        .from(investigations)
        .where(
          and(eq(investigations.workflowId, runKey), eq(investigations.attempt, input.attempt)),
        );
      return { investigationId: existing!.id };
    });
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
      // Replace on retry so refs stay E1..En and nothing is duplicated.
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

    const bundle = {
      version: 1,
      investigationId,
      incident: {
        id: incident!.id,
        title: incident!.title,
        severity: incident!.severity,
        serviceName: incident!.serviceName,
        environment: incident!.environment,
        repositoryFullName: service?.repositoryFullName ?? null,
        firstSeenAt: incident!.firstSeenAt.toISOString(),
        lastSeenAt: incident!.lastSeenAt.toISOString(),
        eventCount: incident!.eventCount,
      },
      note: inv.requestNote,
      coverage: collected.coverage,
      items: rows.map((r, i) => ({
        ref: r.ref,
        id: r.id,
        kind: r.kind,
        title: r.title,
        source: collected.items[i]!.source,
        sourceUrl: r.sourceUrl,
        content: collected.items[i]!.content,
      })),
    };
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
    if (inv.completedAt) return; // already published (activity retry)

    const report = result.reportRef
      ? await this.artifacts.getJson<StoredReport>(result.reportRef)
      : null;
    const items = await this.db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.investigationId, investigationId));
    const byRef = new Map(items.map((e) => [e.ref, e.id]));

    // Defense in depth: re-check every citation against this investigation's evidence rows.
    const valid = (refs: string[]) => refs.length > 0 && refs.every((r) => byRef.has(r));
    const hyps = (report?.hypotheses ?? []).filter(
      (h) => valid(h.supporting_evidence) && h.contradicting_evidence.every((r) => byRef.has(r)),
    );
    const observations = (report?.observations ?? []).filter((o) => valid(o.evidence));
    const status = result.status === 'completed' && hyps.length > 0 ? 'completed' : 'needs_review';
    const reason = status === 'completed' ? null : (result.reason ?? 'no_supported_hypotheses');

    await this.db.transaction(async (tx) => {
      await tx.delete(hypotheses).where(eq(hypotheses.investigationId, investigationId));
      if (hyps.length > 0) {
        await tx.insert(hypotheses).values(
          hyps.map((h, i) => ({
            workspaceId: inv.workspaceId,
            investigationId,
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
          status,
          statusReason: reason,
          model: report?.model ?? result.model,
          promptVersion: report?.prompt_version ?? null,
          reportRef: result.reportRef,
          observations,
          dataGaps: report?.data_gaps ?? [],
          rejected: report?.rejected ?? [],
          usage: report?.usage ?? {},
          completedAt: new Date(),
        })
        .where(eq(investigations.id, investigationId));
      if (report && report.usage.calls > 0) {
        await tx.insert(usageRecords).values([
          {
            workspaceId: inv.workspaceId,
            metric: 'model_input_tokens',
            quantity: String(report.usage.input_tokens),
          },
          {
            workspaceId: inv.workspaceId,
            metric: 'model_output_tokens',
            quantity: String(report.usage.output_tokens),
          },
          {
            workspaceId: inv.workspaceId,
            metric: 'model_cost_usd',
            quantity: String(report.usage.cost_usd),
          },
          { workspaceId: inv.workspaceId, metric: 'investigations', quantity: '1' },
        ]);
      }
      await tx.insert(incidentEvents).values({
        workspaceId: inv.workspaceId,
        incidentId: inv.incidentId,
        kind: 'investigation',
        source: 'ai',
        occurredAt: new Date(),
        summary:
          status === 'completed'
            ? `AI investigation #${inv.attempt} finished with ${hyps.length} hypothesis(es)`
            : `AI investigation #${inv.attempt} needs review: ${reason}`,
        attributes: { investigationId, status, model: report?.model ?? null },
      });
      await this.audit.record(
        {
          workspaceId: inv.workspaceId,
          actorType: 'agent',
          action: 'investigation.completed',
          resourceType: 'investigation',
          resourceId: investigationId,
          outcome: 'success',
          correlationId: inv.workflowId,
          metadata: {
            status,
            reason,
            hypotheses: hyps.length,
            model: report?.model ?? null,
            cost_usd: report?.usage.cost_usd ?? 0,
          },
        },
        tx,
      );
    });
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
      this.transitionIncident(tx, input.incidentId, 'closed_without_fix', input.reason, {
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
