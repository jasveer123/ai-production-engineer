import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, isNotNull, isNull, lte, notExists, notInArray, sql } from 'drizzle-orm';
import { CLOSED_STATUSES, type EscalationRunState, type PolicySource } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  escalationPolicies,
  escalationRuns,
  incidentEvents,
  incidents,
  integrations,
  type StoredStep,
} from '../../../core/db/schema';
import {
  DeliveryLedger,
  type NewAttempt,
} from '../../notifications/application/delivery-ledger.service';
import type { Notification } from '../../notifications/domain/messages';
import { nextPosition, selectSteps } from '../domain/policy-selection';
import { meetsSeverity } from '../domain/severity';
import { RecipientsService } from './recipients.service';

type PolicyRow = typeof escalationPolicies.$inferSelect;
type RunRow = typeof escalationRuns.$inferSelect;
type IncidentRow = typeof incidents.$inferSelect;

export const BUILTIN_POLICY = {
  name: 'Built-in: e-mail the whole team',
  minSeverity: 'high' as const,
  steps: [
    { waitMinutes: 0, targets: [{ kind: 'everyone' as const }], channels: ['email' as const] },
  ],
};

const LEASE_MS = 5 * 60 * 1000;
const BATCH = 50;
const isClosed = (status: string) => (CLOSED_STATUSES as readonly string[]).includes(status);

function decide(policy: PolicyRow | null, incident: IncidentRow, now: Date) {
  const facts = {
    severity: incident.severity,
    attributes: {
      service: incident.serviceName,
      environment: incident.environment,
      source: incident.source,
    },
  };
  const chosen = policy
    ? selectSteps(policy, facts, now)
    : { branch: null, steps: BUILTIN_POLICY.steps as StoredStep[] };
  const gate = policy ? policy.minSeverity : BUILTIN_POLICY.minSeverity;
  return { chosen, skipped: !meetsSeverity(incident.severity, gate) || chosen.steps.length === 0 };
}

@Injectable()
export class EscalationEngine {
  private readonly logger = new Logger(EscalationEngine.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly recipients: RecipientsService,
    private readonly ledger: DeliveryLedger,
  ) {}

  async tick(now = new Date()): Promise<{ started: number; stepsRun: number }> {
    const started = await this.reconcile(now);
    const stepsRun = await this.processDue(now);
    await this.ledger.processDue(now);
    return { started, stepsRun };
  }

  /** Finds every open, unacknowledged incident that has no escalation decision yet, whatever its age. */
  async reconcile(now: Date): Promise<number> {
    const missing = await this.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          notInArray(incidents.status, [...CLOSED_STATUSES]),
          isNull(incidents.acknowledgedAt),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(escalationRuns)
              .where(eq(escalationRuns.incidentId, incidents.id)),
          ),
        ),
      )
      .orderBy(asc(incidents.createdAt))
      .limit(BATCH);
    let started = 0;
    for (const { id } of missing) if (await this.startForIncident(id, now)) started += 1;
    return started;
  }

  async startForIncident(incidentId: string, now = new Date()): Promise<boolean> {
    const [incident] = await this.db.select().from(incidents).where(eq(incidents.id, incidentId));
    if (!incident || incident.acknowledgedAt || isClosed(incident.status)) return false;
    const { policy, source } = await this.choosePolicy(incident);
    const { chosen, skipped } = decide(policy, incident, now);
    const inserted = await this.db
      .insert(escalationRuns)
      .values({
        workspaceId: incident.workspaceId,
        incidentId: incident.id,
        policyId: policy ? policy.id : null,
        policyName: policy ? policy.name : BUILTIN_POLICY.name,
        policySource: source,
        branchName: chosen.branch,
        stepsSnapshot: chosen.steps,
        repeatCount: policy ? policy.repeatCount : 0,
        ...(skipped
          ? { state: 'skipped', finishedAt: now, nextRunAt: null }
          : { nextRunAt: new Date(now.getTime() + (chosen.steps[0]?.waitMinutes ?? 0) * 60_000) }),
      })
      .onConflictDoNothing()
      .returning({ id: escalationRuns.id });
    return inserted.length > 0 && !skipped;
  }

  private async choosePolicy(
    incident: IncidentRow,
  ): Promise<{ policy: PolicyRow | null; source: PolicySource }> {
    const ws = incident.workspaceId;
    const enabled = and(
      eq(escalationPolicies.workspaceId, ws),
      eq(escalationPolicies.enabled, true),
    );
    const [source] = await this.db
      .select({ config: integrations.config })
      .from(incidentEvents)
      .innerJoin(integrations, eq(integrations.id, incidentEvents.integrationId))
      .where(
        and(
          eq(incidentEvents.incidentId, incident.id),
          isNotNull(incidentEvents.integrationId),
          eq(integrations.workspaceId, ws),
        ),
      )
      .orderBy(asc(incidentEvents.occurredAt))
      .limit(1);
    const assigned = source?.config.escalationPolicyId;
    if (typeof assigned === 'string' && /^[0-9a-f-]{36}$/i.test(assigned)) {
      const [policy] = await this.db
        .select()
        .from(escalationPolicies)
        .where(and(enabled, eq(escalationPolicies.id, assigned)));
      if (policy) return { policy, source: 'integration' };
    }
    // Workspaces from before the default flag keep paging through their oldest policy.
    const [fallback] = await this.db
      .select()
      .from(escalationPolicies)
      .where(and(enabled, eq(escalationPolicies.generated, false)))
      .orderBy(sql`${escalationPolicies.isDefault} desc`, asc(escalationPolicies.createdAt))
      .limit(1);
    return fallback ? { policy: fallback, source: 'default' } : { policy: null, source: 'builtin' };
  }

  private async processDue(now: Date): Promise<number> {
    const due = await this.db
      .select({ id: escalationRuns.id })
      .from(escalationRuns)
      .where(and(eq(escalationRuns.state, 'running'), lte(escalationRuns.nextRunAt, now)))
      .limit(BATCH);
    let stepsRun = 0;
    for (const { id } of due) {
      const [claimed] = await this.db
        .update(escalationRuns)
        .set({ nextRunAt: new Date(now.getTime() + LEASE_MS) })
        .where(
          and(
            eq(escalationRuns.id, id),
            eq(escalationRuns.state, 'running'),
            lte(escalationRuns.nextRunAt, now),
          ),
        )
        .returning();
      if (!claimed) continue;
      try {
        if (await this.runStep(claimed, now)) stepsRun += 1;
      } catch (err) {
        this.logger.error(`Escalation run ${id} failed: ${(err as Error).message}`);
      }
    }
    return stepsRun;
  }

  private async finish(run: RunRow, state: EscalationRunState, now: Date): Promise<false> {
    await this.db
      .update(escalationRuns)
      .set({ state, finishedAt: now, nextRunAt: null })
      .where(eq(escalationRuns.id, run.id));
    return false;
  }

  private async stepsOf(run: RunRow): Promise<StoredStep[] | null> {
    if (run.stepsSnapshot) return run.stepsSnapshot;
    if (!run.policyId) return null;
    const [policy] = await this.db
      .select({ steps: escalationPolicies.steps })
      .from(escalationPolicies)
      .where(
        and(
          eq(escalationPolicies.id, run.policyId),
          eq(escalationPolicies.workspaceId, run.workspaceId),
        ),
      );
    return policy?.steps ?? null;
  }

  private notification(incident: IncidentRow, run: RunRow, note: string): Notification {
    return {
      type: 'incident.detected',
      key: `esc:${run.id}:${run.repeatsDone}:${run.stepIndex}`,
      occurredAt: incident.createdAt.toISOString(),
      summary: incident.description?.slice(0, 500) ?? '',
      url: `${this.env.WEB_URL}/incidents/${incident.id}`,
      note,
      incident: {
        id: incident.id,
        workspaceId: incident.workspaceId,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        serviceName: incident.serviceName,
        environment: incident.environment,
      },
    };
  }

  private async runStep(run: RunRow, now: Date): Promise<boolean> {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, run.incidentId), eq(incidents.workspaceId, run.workspaceId)));
    if (!incident) return this.finish(run, 'cancelled', now);
    if (incident.acknowledgedAt) return this.finish(run, 'acknowledged', now);
    if (isClosed(incident.status)) return this.finish(run, 'cancelled', now);
    const steps = await this.stepsOf(run);
    const step = steps?.[run.stepIndex];
    if (!steps || !step) return this.finish(run, steps ? 'completed' : 'cancelled', now);

    const next = nextPosition(run, steps);
    const note = next
      ? `If nobody acknowledges within ${next.waitMinutes} minutes, the next people are notified.`
      : 'This is the last step of the escalation.';
    const n = this.notification(
      incident,
      run,
      `Press Acknowledge on the incident page to stop paging. ${note}`,
    );
    const planned = await this.recipients.plan(run.workspaceId, step, incident.severity);
    const attempts: NewAttempt[] = planned.map((p) => ({
      workspaceId: run.workspaceId,
      incidentId: incident.id,
      runId: run.id,
      stepIndex: run.stepIndex,
      channelId: p.channelId,
      userId: p.userId,
      dedupKey: `${n.key}:${p.channelId ?? p.userId}:${p.channel}:${p.address}`,
      eventType: 'escalation',
      channel: p.channel,
      address: p.address,
      recipientName: p.name,
      payload: n,
      ...(p.problem ? { problem: p.problem } : {}),
    }));
    const ids = await this.db.transaction(async (tx) => {
      const queued = await this.ledger.enqueue(tx, attempts);
      const [moved] = await tx
        .update(escalationRuns)
        .set(
          next
            ? {
                stepIndex: next.stepIndex,
                repeatsDone: next.repeatsDone,
                nextRunAt: new Date(now.getTime() + next.waitMinutes * 60_000),
              }
            : {
                stepIndex: run.stepIndex + 1,
                state: 'completed',
                finishedAt: now,
                nextRunAt: null,
              },
        )
        .where(and(eq(escalationRuns.id, run.id), eq(escalationRuns.nextRunAt, run.nextRunAt!)))
        .returning({ id: escalationRuns.id });
      if (!moved) throw new Error('Run was claimed by another worker');
      return queued;
    });
    await this.ledger.deliverNow(ids);
    return true;
  }
}
