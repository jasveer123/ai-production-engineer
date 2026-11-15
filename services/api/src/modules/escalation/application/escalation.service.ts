import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import type {
  CreatePolicyInput,
  EscalationRunState,
  EscalationRunView,
  PersonChannel,
  PolicyPreview,
  PolicySource,
  PolicyStepView,
  PolicyView,
  SimplePolicyInput,
  UpdatePolicyInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  escalationPolicies,
  escalationRuns,
  incidents,
  notificationChannels,
  oncallSchedules,
  users,
  workspaceMembers,
  type StoredBranch,
  type StoredStep,
} from '../../../core/db/schema';
import { DeliveryLog } from '../../notifications/application/delivery-log.service';
import { simplePolicySteps } from '../domain/policy-selection';
import { EscalationEngine } from './escalation-engine.service';
import { RecipientsService } from './recipients.service';

type PolicyRow = typeof escalationPolicies.$inferSelect;

const RECENT_RUNS = 30;

const allSteps = (steps: StoredStep[], branches: StoredBranch[]) => [
  ...steps,
  ...branches.flatMap((b) => b.steps),
];

@Injectable()
export class EscalationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly engine: EscalationEngine,
    private readonly recipients: RecipientsService,
    private readonly log: DeliveryLog,
  ) {}

  private async labels(workspaceId: string, steps: StoredStep[]): Promise<Map<string, string>> {
    const ids = {
      user: new Set<string>(),
      schedule: new Set<string>(),
      channel: new Set<string>(),
    };
    for (const step of steps)
      for (const t of step.targets) {
        if (t.userId) ids.user.add(t.userId);
        if (t.scheduleId) ids.schedule.add(t.scheduleId);
        if (t.channelId) ids.channel.add(t.channelId);
      }
    const map = new Map<string, string>();
    if (ids.user.size) {
      const rows = await this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), inArray(users.id, [...ids.user])),
        );
      rows.forEach((r) => map.set(`user:${r.id}`, r.name ?? r.email));
    }
    if (ids.schedule.size) {
      const rows = await this.db
        .select({ id: oncallSchedules.id, name: oncallSchedules.name })
        .from(oncallSchedules)
        .where(
          and(
            eq(oncallSchedules.workspaceId, workspaceId),
            inArray(oncallSchedules.id, [...ids.schedule]),
          ),
        );
      rows.forEach((r) => map.set(`schedule:${r.id}`, `On call · ${r.name}`));
    }
    if (ids.channel.size) {
      const rows = await this.db
        .select({
          id: notificationChannels.id,
          name: notificationChannels.name,
          kind: notificationChannels.kind,
        })
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.workspaceId, workspaceId),
            inArray(notificationChannels.id, [...ids.channel]),
          ),
        );
      rows.forEach((r) => map.set(`channel:${r.id}`, `${r.kind} · ${r.name}`));
    }
    return map;
  }

  private stepViews(steps: StoredStep[], labels: Map<string, string>): PolicyStepView[] {
    return steps.map((step) => ({
      waitMinutes: step.waitMinutes,
      channels: step.channels ?? (['email'] as PersonChannel[]),
      targets: step.targets.map((t) => {
        const key = `${t.kind}:${t.userId ?? t.scheduleId ?? t.channelId}`;
        const label = t.kind === 'everyone' ? 'Entire team' : (labels.get(key) ?? 'Removed');
        return { ...(t as { kind: 'everyone' }), label };
      }),
    }));
  }

  private async toView(row: PolicyRow): Promise<PolicyView> {
    const labels = await this.labels(row.workspaceId, allSteps(row.steps, row.branches));
    return {
      id: row.id,
      name: row.name,
      minSeverity: row.minSeverity,
      enabled: row.enabled,
      isDefault: row.isDefault,
      generated: row.generated,
      repeatCount: row.repeatCount,
      steps: this.stepViews(row.steps, labels),
      branches: row.branches.map((b) => ({
        name: b.name,
        when: b.when,
        steps: this.stepViews(b.steps, labels),
      })),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async requireTargets(workspaceId: string, steps: StoredStep[]): Promise<void> {
    const labels = await this.labels(workspaceId, steps);
    for (const step of steps)
      for (const t of step.targets) {
        const id = t.userId ?? t.scheduleId ?? t.channelId;
        if (t.kind !== 'everyone' && !labels.has(`${t.kind}:${id}`))
          throw notFound('Escalation target');
      }
  }

  private async clearDefault(tx: Tx, workspaceId: string, keep: string): Promise<void> {
    await tx
      .update(escalationPolicies)
      .set({ isDefault: false })
      .where(and(eq(escalationPolicies.workspaceId, workspaceId), ne(escalationPolicies.id, keep)));
  }

  async list(actor: ActorContext): Promise<PolicyView[]> {
    const rows = await this.db
      .select()
      .from(escalationPolicies)
      .where(eq(escalationPolicies.workspaceId, actor.workspaceId))
      .orderBy(asc(escalationPolicies.createdAt));
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async create(
    actor: ActorContext,
    input: CreatePolicyInput,
    generated = false,
  ): Promise<PolicyView> {
    const steps = input.steps as StoredStep[];
    const branches = (input.branches ?? []) as StoredBranch[];
    await this.requireTargets(actor.workspaceId, allSteps(steps, branches));
    const row = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .insert(escalationPolicies)
        .values({
          workspaceId: actor.workspaceId,
          name: input.name,
          minSeverity: input.minSeverity ?? 'high',
          enabled: input.enabled ?? true,
          isDefault: input.isDefault ?? false,
          repeatCount: input.repeatCount ?? 0,
          generated,
          steps,
          branches,
          createdBy: actor.userId,
        })
        .returning();
      if (r!.isDefault) await this.clearDefault(tx, actor.workspaceId, r!.id);
      return r!;
    });
    await this.record(actor, 'escalation.policy_created', row.id);
    return this.toView(row);
  }

  async update(actor: ActorContext, id: string, input: UpdatePolicyInput): Promise<PolicyView> {
    await this.find(actor, id);
    await this.requireTargets(actor.workspaceId, allSteps(input.steps ?? [], input.branches ?? []));
    const row = await this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(escalationPolicies)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.minSeverity ? { minSeverity: input.minSeverity } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.repeatCount !== undefined ? { repeatCount: input.repeatCount } : {}),
          ...(input.steps ? { steps: input.steps } : {}),
          ...(input.branches ? { branches: input.branches } : {}),
        })
        .where(
          and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
        )
        .returning();
      if (r!.isDefault) await this.clearDefault(tx, actor.workspaceId, r!.id);
      return r!;
    });
    await this.record(actor, 'escalation.policy_updated', id);
    return this.toView(row);
  }

  async saveSimple(actor: ActorContext, input: SimplePolicyInput): Promise<PolicyView> {
    const labels = await this.labels(actor.workspaceId, [
      { waitMinutes: 0, targets: [input.primary] },
    ]);
    const who = labels.get(
      `${input.primary.kind}:${'userId' in input.primary ? input.primary.userId : input.primary.scheduleId}`,
    );
    const body = {
      name: `Primary responder: ${who ?? 'removed'}`.slice(0, 80),
      minSeverity: 'low' as const,
      steps: simplePolicySteps(input) as NonNullable<UpdatePolicyInput['steps']>,
    };
    if (input.policyId) {
      const existing = await this.find(actor, input.policyId);
      if (existing.generated) return this.update(actor, existing.id, body);
    }
    return this.create(actor, body, true);
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

  async preview(actor: ActorContext, id: string): Promise<PolicyPreview[]> {
    const row = await this.find(actor, id);
    const severity = row.minSeverity;
    const variants = [
      { branch: null as string | null, steps: row.steps },
      ...row.branches.map((b) => ({ branch: b.name, steps: b.steps })),
    ];
    return Promise.all(
      variants.map(async (v) => ({
        branch: v.branch,
        steps: await Promise.all(
          v.steps.map(async (step) => ({
            waitMinutes: step.waitMinutes,
            recipients: (await this.recipients.plan(actor.workspaceId, step, severity)).map(
              (p) => ({
                name: p.name,
                channel: p.channel,
                address: p.address,
                problem: p.problem,
              }),
            ),
          })),
        ),
      })),
    );
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
      .leftJoin(escalationPolicies, eq(escalationPolicies.id, escalationRuns.policyId))
      .where(
        and(eq(escalationRuns.workspaceId, actor.workspaceId), ne(escalationRuns.state, 'skipped')),
      )
      .orderBy(desc(escalationRuns.startedAt))
      .limit(RECENT_RUNS);
    const deliveries = await this.log.forRuns(
      actor.workspaceId,
      rows.map((r) => r.run.id),
    );
    return rows.map(({ run, ...r }) => ({
      id: run.id,
      incidentId: run.incidentId,
      incidentTitle: r.title,
      severity: r.severity,
      policyId: run.policyId,
      policyName: run.policyName ?? r.policyName ?? 'Removed policy',
      policySource: (run.policySource ?? 'legacy') as PolicySource,
      branch: run.branchName,
      state: run.state as EscalationRunState,
      stepsDone: run.stepIndex,
      totalSteps: (run.stepsSnapshot ?? r.steps ?? []).length,
      repeatsDone: run.repeatsDone,
      repeatCount: run.repeatCount,
      nextRunAt: run.nextRunAt?.toISOString() ?? null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      deliveries: deliveries.filter((d) => d.runId === run.id).reverse(),
    }));
  }

  tick(now = new Date()) {
    return this.engine.tick(now);
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
