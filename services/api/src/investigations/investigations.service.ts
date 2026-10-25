import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type {
  HypothesisFeedbackInput,
  HypothesisVerdict,
  IncidentActionInput,
  IncidentInvestigation,
  InvestigationView,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { ApiException, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  approvals,
  evidenceItems,
  hypotheses,
  hypothesisFeedback,
  incidents,
  investigations,
} from '../db/schema';
import { TemporalService } from '../temporal/temporal.service';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class InvestigationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly temporal: TemporalService,
    private readonly artifacts: ArtifactStore,
    private readonly audit: AuditService,
    private readonly usage: UsageService,
  ) {}

  private async incident(actor: ActorContext, incidentId: string) {
    const [inc] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.workspaceId, actor.workspaceId)));
    if (!inc) throw notFound('Incident');
    return inc;
  }

  async forIncident(actor: ActorContext, incidentId: string): Promise<IncidentInvestigation> {
    await this.incident(actor, incidentId);
    const [latest] = await this.db
      .select()
      .from(investigations)
      .where(
        and(
          eq(investigations.incidentId, incidentId),
          eq(investigations.workspaceId, actor.workspaceId),
        ),
      )
      .orderBy(desc(investigations.createdAt))
      .limit(1);
    const [{ n } = { n: 0 }] = await this.db
      .select({ n: count() })
      .from(investigations)
      .where(eq(investigations.incidentId, incidentId));
    const approved = await this.db
      .select({ id: approvals.id })
      .from(approvals)
      .where(and(eq(approvals.resourceType, 'reproduction'), eq(approvals.resourceId, incidentId)));
    let workflow: IncidentInvestigation['workflow'] = null;
    try {
      const s = await this.temporal.state(incidentId);
      workflow = s ? { phase: s.phase, attempt: s.attempt } : null;
    } catch {
      workflow = { phase: 'unknown (Temporal unreachable)', attempt: 0 };
    }
    return {
      latest: latest ? await this.view(latest, actor.userId) : null,
      attempts: Number(n),
      workflow,
      reproductionApproved: approved.length > 0,
    };
  }

  private async view(
    inv: typeof investigations.$inferSelect,
    userId: string,
  ): Promise<InvestigationView> {
    const ev = await this.db
      .select()
      .from(evidenceItems)
      .where(eq(evidenceItems.investigationId, inv.id))
      .orderBy(asc(evidenceItems.createdAt));
    ev.sort((a, b) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)));
    const refById = new Map(ev.map((e) => [e.id, e.ref]));
    const hs = await this.db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.investigationId, inv.id))
      .orderBy(asc(hypotheses.rank));
    const votes = hs.length
      ? await this.db
          .select({
            hypothesisId: hypothesisFeedback.hypothesisId,
            userId: hypothesisFeedback.userId,
            verdict: hypothesisFeedback.verdict,
          })
          .from(hypothesisFeedback)
          .where(
            inArray(
              hypothesisFeedback.hypothesisId,
              hs.map((h) => h.id),
            ),
          )
      : [];
    const feedbackFor = (id: string): InvestigationView['hypotheses'][number]['feedback'] => {
      const mine = votes.filter((v) => v.hypothesisId === id);
      const n = (v: HypothesisVerdict) => mine.filter((x) => x.verdict === v).length;
      return {
        correct: n('correct'),
        partly: n('partly'),
        wrong: n('wrong'),
        mine: (mine.find((x) => x.userId === userId)?.verdict as HypothesisVerdict) ?? null,
      };
    };
    return {
      id: inv.id,
      attempt: inv.attempt,
      status: inv.status as InvestigationView['status'],
      statusReason: inv.statusReason,
      model: inv.model,
      promptVersion: inv.promptVersion,
      coverage: inv.coverage as Record<string, string | number>,
      observations: inv.observations as InvestigationView['observations'],
      dataGaps: inv.dataGaps,
      rejectedCount: inv.rejected.length,
      usage: inv.usage,
      requestNote: inv.requestNote,
      startedAt: inv.startedAt?.toISOString() ?? null,
      completedAt: inv.completedAt?.toISOString() ?? null,
      evidence: ev.map((e) => ({
        id: e.id,
        ref: e.ref,
        kind: e.kind as InvestigationView['evidence'][number]['kind'],
        title: e.title,
        sourceReference: e.sourceReference,
        sourceUrl: e.sourceUrl,
      })),
      hypotheses: hs.map((h) => ({
        id: h.id,
        rank: h.rank,
        summary: h.summary,
        confidence: (h.confidenceLabel as 'high' | 'medium' | 'low' | null) ?? null,
        confidenceRationale: h.confidenceRationale,
        supportingEvidence: h.supportingEvidenceIds.map((id) => refById.get(id) ?? '?'),
        contradictingEvidence: h.contradictingEvidenceIds.map((id) => refById.get(id) ?? '?'),
        missingInformation: h.missingInformation,
        suspectedLocation:
          h.suspectedLocation as InvestigationView['hypotheses'][number]['suspectedLocation'],
        feedback: feedbackFor(h.id),
      })),
    };
  }

  /** The exact (redacted) evidence text an item holds, read from the stored bundle. */
  async evidenceContent(
    actor: ActorContext,
    incidentId: string,
    evidenceId: string,
  ): Promise<{ ref: string; title: string; content: string }> {
    await this.incident(actor, incidentId);
    const [item] = await this.db
      .select({ e: evidenceItems, incidentId: investigations.incidentId })
      .from(evidenceItems)
      .innerJoin(investigations, eq(investigations.id, evidenceItems.investigationId))
      .where(
        and(eq(evidenceItems.id, evidenceId), eq(evidenceItems.workspaceId, actor.workspaceId)),
      );
    if (!item || item.incidentId !== incidentId || !item.e.artifactReference)
      throw notFound('Evidence');
    const bundle = await this.artifacts.getJson<{ items: { id: string; content: string }[] }>(
      item.e.artifactReference,
    );
    const content = bundle.items.find((i) => i.id === evidenceId)?.content;
    if (content === undefined) throw notFound('Evidence');
    return { ref: item.e.ref, title: item.e.title, content };
  }

  async act(
    actor: ActorContext,
    incidentId: string,
    input: IncidentActionInput,
  ): Promise<IncidentInvestigation> {
    const inc = await this.incident(actor, incidentId);
    const wf = { incidentId, workspaceId: actor.workspaceId };
    const state = await this.temporal.state(incidentId).catch(() => {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'temporal_unavailable',
        'The workflow engine is not reachable',
      );
    });
    const awaiting = state?.running && state.phase === 'awaiting_decision';

    if (input.action === 'investigate') {
      if (state?.running && state.phase === 'investigating') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'investigation_running',
          'An investigation is already running',
        );
      }
      const blocked = await this.usage.blockedReason(actor.workspaceId);
      if (blocked) {
        await this.usage.recordBlocked({
          workspaceId: actor.workspaceId,
          incidentId,
          reason: blocked,
          actorId: actor.userId,
          correlationId: actor.correlationId,
        });
        throw new ApiException(
          HttpStatus.CONFLICT,
          'usage_limit_reached',
          `Investigation not started: ${blocked}`,
        );
      }
      await this.temporal.requestInvestigation(wf, actor.userId, input.note ?? null);
    } else {
      if (!awaiting) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'not_awaiting_decision',
          'Wait for the investigation to finish first',
        );
      }
      if (input.action === 'approve_reproduction') {
        const [latest] = await this.db
          .select({ status: investigations.status })
          .from(investigations)
          .where(eq(investigations.incidentId, incidentId))
          .orderBy(desc(investigations.createdAt))
          .limit(1);
        if (latest?.status !== 'completed') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'no_report',
            'Reproduction needs a completed report with hypotheses',
          );
        }
        if (!inc.serviceId) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'repository_not_mapped',
            'Map the service to a repository first',
          );
        }
        await this.temporal.approveReproduction(incidentId, actor.userId);
      } else {
        await this.temporal.dismiss(
          incidentId,
          actor.userId,
          input.note || 'Dismissed after investigation',
        );
      }
    }
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: `investigation.${input.action}`,
      resourceType: 'incident',
      resourceId: incidentId,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { note: input.note ?? null, phase: state?.phase ?? null },
    });
    return this.forIncident(actor, incidentId);
  }

  /** An engineer's verdict on a hypothesis (Phase 9). Re-voting replaces the earlier verdict. */
  async feedback(
    actor: ActorContext,
    incidentId: string,
    input: HypothesisFeedbackInput,
  ): Promise<IncidentInvestigation> {
    await this.incident(actor, incidentId);
    const [h] = await this.db
      .select({
        id: hypotheses.id,
        investigationId: hypotheses.investigationId,
        rank: hypotheses.rank,
      })
      .from(hypotheses)
      .innerJoin(investigations, eq(investigations.id, hypotheses.investigationId))
      .where(
        and(
          eq(hypotheses.id, input.hypothesisId),
          eq(investigations.incidentId, incidentId),
          eq(hypotheses.workspaceId, actor.workspaceId),
        ),
      );
    if (!h) throw notFound('Hypothesis');
    await this.db
      .insert(hypothesisFeedback)
      .values({
        workspaceId: actor.workspaceId,
        investigationId: h.investigationId,
        hypothesisId: h.id,
        userId: actor.userId,
        verdict: input.verdict,
        note: input.note ?? null,
      })
      .onConflictDoUpdate({
        target: [hypothesisFeedback.hypothesisId, hypothesisFeedback.userId],
        set: { verdict: input.verdict, note: input.note ?? null },
      });
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'hypothesis.feedback',
      resourceType: 'hypothesis',
      resourceId: h.id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { verdict: input.verdict, rank: h.rank, incidentId },
    });
    return this.forIncident(actor, incidentId);
  }
}
