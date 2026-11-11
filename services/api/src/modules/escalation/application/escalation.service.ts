import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lte, notInArray, sql } from 'drizzle-orm';
import {
  CLOSED_STATUSES,
  type CreatePolicyInput,
  type EscalationRunView,
  type EscalationRunState,
  type PolicyView,
  type UpdatePolicyInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  escalationNotifications,
  escalationPolicies,
  escalationRuns,
  incidents,
  oncallSchedules,
  users,
  workspaceMembers,
  type StoredStep,
} from '../../../core/db/schema';
import { Mailer } from '../../auth/infrastructure/mailer.service';
import { OncallService } from '../../oncall/application/oncall.service';
import { meetsSeverity } from '../domain/severity';

type PolicyRow = typeof escalationPolicies.$inferSelect;
type RunRow = typeof escalationRuns.$inferSelect;

const LOOKBACK_MS = 24 * 3600 * 1000;
const LEASE_MS = 5 * 60 * 1000;
const BATCH = 50;
const RECENT_RUNS = 30;

interface Recipient {
  userId: string;
  email: string;
  name: string | null;
}

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly mailer: Mailer,
    private readonly oncall: OncallService,
    private readonly audit: AuditService,
  ) {}

  private async labels(workspaceId: string, steps: StoredStep[]): Promise<Map<string, string>> {
    const userIds = new Set<string>();
    const scheduleIds = new Set<string>();
    for (const step of steps)
      for (const t of step.targets) {
        if (t.userId) userIds.add(t.userId);
        if (t.scheduleId) scheduleIds.add(t.scheduleId);
      }
    const map = new Map<string, string>();
    if (userIds.size) {
      const rows = await this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, [...userIds]));
      rows.forEach((r) => map.set(`user:${r.id}`, r.name ?? r.email));
    }
    if (scheduleIds.size) {
      const rows = await this.db
        .select({ id: oncallSchedules.id, name: oncallSchedules.name })
        .from(oncallSchedules)
        .where(
          and(
            eq(oncallSchedules.workspaceId, workspaceId),
            inArray(oncallSchedules.id, [...scheduleIds]),
          ),
        );
      rows.forEach((r) => map.set(`schedule:${r.id}`, r.name));
    }
    return map;
  }

  private async toView(row: PolicyRow): Promise<PolicyView> {
    const labels = await this.labels(row.workspaceId, row.steps);
    return {
      id: row.id,
      name: row.name,
      minSeverity: row.minSeverity,
      enabled: row.enabled,
      steps: row.steps.map((step) => ({
        waitMinutes: step.waitMinutes,
        targets: step.targets.map((t) => ({
          ...(t as { kind: 'everyone' }),
          label:
            t.kind === 'everyone'
              ? 'Everyone in the workspace'
              : (labels.get(`${t.kind}:${t.kind === 'user' ? t.userId : t.scheduleId}`) ??
                'Removed'),
        })),
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async requireTargets(workspaceId: string, steps: StoredStep[]): Promise<void> {
    const labels = await this.labels(workspaceId, steps);
    const members = new Set(
      (
        await this.db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspaceId))
      ).map((m) => m.userId),
    );
    for (const step of steps)
      for (const t of step.targets) {
        const ok =
          t.kind === 'everyone' ||
          (t.kind === 'schedule' && labels.has(`schedule:${t.scheduleId}`)) ||
          (t.kind === 'user' && members.has(t.userId ?? ''));
        if (!ok) throw notFound('Escalation target');
      }
  }

  async list(actor: ActorContext): Promise<PolicyView[]> {
    const rows = await this.db
      .select()
      .from(escalationPolicies)
      .where(eq(escalationPolicies.workspaceId, actor.workspaceId))
      .orderBy(asc(escalationPolicies.createdAt));
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async create(actor: ActorContext, input: CreatePolicyInput): Promise<PolicyView> {
    const steps = input.steps as StoredStep[];
    await this.requireTargets(actor.workspaceId, steps);
    const [row] = await this.db
      .insert(escalationPolicies)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        minSeverity: input.minSeverity ?? 'high',
        enabled: input.enabled ?? true,
        steps,
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, 'escalation.policy_created', row!.id);
    return this.toView(row!);
  }

  async update(actor: ActorContext, id: string, input: UpdatePolicyInput): Promise<PolicyView> {
    await this.find(actor, id);
    if (input.steps) await this.requireTargets(actor.workspaceId, input.steps);
    const [row] = await this.db
      .update(escalationPolicies)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.minSeverity ? { minSeverity: input.minSeverity } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.steps ? { steps: input.steps } : {}),
      })
      .where(
        and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
      )
      .returning();
    await this.record(actor, 'escalation.policy_updated', id);
    return this.toView(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor, id);
    await this.db
      .delete(escalationPolicies)
      .where(
        and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
      );
    await this.record(actor, 'escalation.policy_deleted', id);
  }

  private async find(actor: ActorContext, id: string): Promise<PolicyRow> {
    const [row] = await this.db
      .select()
      .from(escalationPolicies)
      .where(
        and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
      );
    if (!row) throw notFound('Escalation policy');
    return row;
  }

  async runs(actor: ActorContext): Promise<EscalationRunView[]> {
    const rows = await this.db
      .select({
        run: escalationRuns,
        title: incidents.title,
        severity: incidents.severity,
        policyName: escalationPolicies.name,
        steps: escalationPolicies.steps,
      })
      .from(escalationRuns)
      .innerJoin(incidents, eq(incidents.id, escalationRuns.incidentId))
      .innerJoin(escalationPolicies, eq(escalationPolicies.id, escalationRuns.policyId))
      .where(eq(escalationRuns.workspaceId, actor.workspaceId))
      .orderBy(desc(escalationRuns.startedAt))
      .limit(RECENT_RUNS);
    if (rows.length === 0) return [];
    const sent = await this.db
      .select({
        runId: escalationNotifications.runId,
        stepIndex: escalationNotifications.stepIndex,
        email: escalationNotifications.email,
        name: users.name,
        status: escalationNotifications.status,
        error: escalationNotifications.error,
        sentAt: escalationNotifications.sentAt,
      })
      .from(escalationNotifications)
      .leftJoin(users, eq(users.id, escalationNotifications.userId))
      .where(
        and(
          eq(escalationNotifications.workspaceId, actor.workspaceId),
          inArray(
            escalationNotifications.runId,
            rows.map((r) => r.run.id),
          ),
        ),
      )
      .orderBy(asc(escalationNotifications.sentAt));
    return rows.map((r) => ({
      id: r.run.id,
      incidentId: r.run.incidentId,
      incidentTitle: r.title,
      severity: r.severity,
      policyId: r.run.policyId,
      policyName: r.policyName,
      state: r.run.state as EscalationRunState,
      stepsDone: r.run.stepIndex,
      totalSteps: r.steps.length,
      nextRunAt: r.run.nextRunAt?.toISOString() ?? null,
      startedAt: r.run.startedAt.toISOString(),
      finishedAt: r.run.finishedAt?.toISOString() ?? null,
      notifications: sent
        .filter((n) => n.runId === r.run.id)
        .map((n) => ({
          stepIndex: n.stepIndex,
          email: n.email,
          name: n.name,
          status: n.status as 'sent' | 'failed',
          error: n.error,
          sentAt: n.sentAt.toISOString(),
        })),
    }));
  }

  async tick(now = new Date()): Promise<{ started: number; stepsRun: number }> {
    const started = await this.startRuns(now);
    const stepsRun = await this.processDue(now);
    return { started, stepsRun };
  }

  private async startRuns(now: Date): Promise<number> {
    const policies = await this.db
      .select()
      .from(escalationPolicies)
      .where(eq(escalationPolicies.enabled, true));
    let created = 0;
    for (const policy of policies) {
      const since = new Date(Math.max(policy.createdAt.getTime(), now.getTime() - LOOKBACK_MS));
      const candidates = await this.db
        .select({ id: incidents.id, severity: incidents.severity })
        .from(incidents)
        .where(
          and(
            eq(incidents.workspaceId, policy.workspaceId),
            notInArray(incidents.status, [...CLOSED_STATUSES]),
            isNull(incidents.acknowledgedAt),
            gt(incidents.createdAt, since),
          ),
        )
        .limit(200);
      for (const incident of candidates.filter((c) =>
        meetsSeverity(c.severity, policy.minSeverity),
      )) {
        const inserted = await this.db
          .insert(escalationRuns)
          .values({
            workspaceId: policy.workspaceId,
            incidentId: incident.id,
            policyId: policy.id,
            nextRunAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: escalationRuns.id });
        created += inserted.length;
      }
    }
    return created;
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

  private async finish(run: RunRow, state: EscalationRunState, now: Date): Promise<void> {
    await this.db
      .update(escalationRuns)
      .set({ state, finishedAt: now, nextRunAt: null })
      .where(eq(escalationRuns.id, run.id));
  }

  private async runStep(run: RunRow, now: Date): Promise<boolean> {
    const [policy] = await this.db
      .select()
      .from(escalationPolicies)
      .where(eq(escalationPolicies.id, run.policyId));
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(eq(incidents.id, run.incidentId));
    if (!policy || !incident || !policy.enabled) {
      await this.finish(run, 'cancelled', now);
      return false;
    }
    if (incident.acknowledgedAt) {
      await this.finish(run, 'acknowledged', now);
      return false;
    }
    if ((CLOSED_STATUSES as readonly string[]).includes(incident.status)) {
      await this.finish(run, 'cancelled', now);
      return false;
    }
    const step = policy.steps[run.stepIndex];
    if (!step) {
      await this.finish(run, 'completed', now);
      return false;
    }

    const recipients = await this.recipients(run.workspaceId, step);
    const link = `${this.env.WEB_URL}/incidents/${incident.id}`;
    const next = policy.steps[run.stepIndex + 1];
    for (const person of recipients) {
      await this.mailer.send({
        to: person.email,
        subject: `[${incident.severity}] ${incident.title}`,
        text: [
          `${incident.title}`,
          `Severity: ${incident.severity}. Status: ${incident.status}.`,
          incident.serviceName ? `Service: ${incident.serviceName}` : '',
          '',
          `Open it and press Acknowledge: ${link}`,
          next
            ? `If nobody acknowledges within ${next.waitMinutes} minutes, the next people are notified.`
            : 'This is the last step of the escalation.',
        ]
          .filter((line, i) => line !== '' || i > 0)
          .join('\n'),
      });
      await this.db.insert(escalationNotifications).values({
        workspaceId: run.workspaceId,
        runId: run.id,
        stepIndex: run.stepIndex,
        userId: person.userId,
        email: person.email,
        status: 'sent',
      });
    }
    await this.db
      .update(escalationRuns)
      .set(
        next
          ? {
              stepIndex: run.stepIndex + 1,
              nextRunAt: new Date(now.getTime() + next.waitMinutes * 60_000),
            }
          : { stepIndex: run.stepIndex + 1, state: 'completed', finishedAt: now, nextRunAt: null },
      )
      .where(eq(escalationRuns.id, run.id));
    return true;
  }

  private async recipients(workspaceId: string, step: StoredStep): Promise<Recipient[]> {
    const found = new Map<string, Recipient>();
    const ids = new Set<string>();
    let everyone = false;
    for (const t of step.targets) {
      if (t.kind === 'everyone') everyone = true;
      else if (t.kind === 'user' && t.userId) ids.add(t.userId);
      else if (t.kind === 'schedule' && t.scheduleId) {
        const person = await this.oncall.currentOnCall(workspaceId, t.scheduleId);
        if (person) ids.add(person.userId);
      }
    }
    const rows = await this.db
      .select({ userId: users.id, email: users.email, name: users.name })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          everyone
            ? sql`true`
            : inArray(users.id, ids.size ? [...ids] : ['00000000-0000-0000-0000-000000000000']),
        ),
      );
    rows.forEach((r) => found.set(r.userId, r));
    return [...found.values()];
  }

  private record(actor: ActorContext, action: string, id: string) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'escalation_policy',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {},
    });
  }
}
