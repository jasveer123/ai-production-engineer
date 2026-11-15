import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type {
  CreateMetricAlertInput,
  MetricAlertCondition,
  MetricAlertQuery,
  MetricAlertState,
  MetricAlertView,
  MissingDataPolicy,
  UpdateMetricAlertInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  escalationPolicies,
  integrations,
  metricAlertRules,
  metricAlertStates,
} from '../../../core/db/schema';
import { ALERT_SOURCE_PROVIDER } from '../../alerts/application/alert-sources.service';
import { MetricAlertEvaluator, type RuleRow } from './metric-alert-evaluator.service';

type StateRow = typeof metricAlertStates.$inferSelect;
type CreateInput = Required<Omit<CreateMetricAlertInput, 'escalationPolicyId'>> & {
  escalationPolicyId?: string | null;
};

const RANK: MetricAlertState[] = ['firing', 'recovering', 'pending', 'no_data', 'error', 'ok'];

function toView(rule: RuleRow, states: StateRow[]): MetricAlertView {
  const worst = RANK.find((r) => states.some((s) => s.state === r)) ?? 'ok';
  return {
    id: rule.id,
    name: rule.name,
    query: rule.query as unknown as MetricAlertQuery,
    condition: rule.condition as unknown as MetricAlertCondition,
    windowMinutes: rule.windowMinutes,
    everySeconds: rule.everySeconds,
    perSeries: rule.perSeries,
    confirmationSeconds: rule.confirmationSeconds,
    recoverySeconds: rule.recoverySeconds,
    missingData: rule.missingData as MissingDataPolicy,
    severity: rule.severity,
    escalationPolicyId: rule.escalationPolicyId,
    paused: rule.paused,
    state: rule.lastError ? 'error' : worst,
    series: states.map((s) => ({
      series: s.seriesKey,
      state: s.state as MetricAlertState,
      since: s.since.toISOString(),
      lastValue: s.lastValue,
      observation: s.lastObservation,
    })),
    lastEvaluatedAt: rule.lastEvaluatedAt?.toISOString() ?? null,
    lastError: rule.lastError,
    createdAt: rule.createdAt.toISOString(),
  };
}

@Injectable()
export class MetricAlertsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly evaluator: MetricAlertEvaluator,
    private readonly audit: AuditService,
  ) {}

  async list(actor: ActorContext): Promise<MetricAlertView[]> {
    const rules = await this.db
      .select()
      .from(metricAlertRules)
      .where(eq(metricAlertRules.workspaceId, actor.workspaceId))
      .orderBy(asc(metricAlertRules.createdAt));
    if (rules.length === 0) return [];
    const states = await this.db
      .select()
      .from(metricAlertStates)
      .where(
        and(
          eq(metricAlertStates.workspaceId, actor.workspaceId),
          inArray(
            metricAlertStates.ruleId,
            rules.map((r) => r.id),
          ),
        ),
      );
    return rules.map((r) =>
      toView(
        r,
        states.filter((s) => s.ruleId === r.id),
      ),
    );
  }

  async create(actor: ActorContext, input: CreateInput): Promise<MetricAlertView> {
    await this.checkPolicy(actor, input.escalationPolicyId);
    const rule = await this.db.transaction(async (tx) => {
      const [source] = await tx
        .insert(integrations)
        .values({
          workspaceId: actor.workspaceId,
          provider: ALERT_SOURCE_PROVIDER,
          name: input.name,
          config: { kind: 'metric_alert', escalationPolicyId: input.escalationPolicyId ?? null },
          status: 'connected',
        })
        .returning({ id: integrations.id });
      const [row] = await tx
        .insert(metricAlertRules)
        .values({
          ...input,
          workspaceId: actor.workspaceId,
          sourceId: source!.id,
          escalationPolicyId: input.escalationPolicyId ?? null,
          createdBy: actor.userId,
        })
        .returning();
      return row!;
    });
    await this.record(actor, 'metric_alert.created', rule.id);
    return toView(rule, []);
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateMetricAlertInput,
  ): Promise<MetricAlertView> {
    const rule = await this.find(actor, id);
    if (input.escalationPolicyId !== undefined)
      await this.checkPolicy(actor, input.escalationPolicyId);
    const reshaped = input.query !== undefined || input.perSeries !== undefined;
    const [updated] = await this.db
      .update(metricAlertRules)
      .set({ ...input, nextEvalAt: new Date() })
      .where(
        and(eq(metricAlertRules.id, rule.id), eq(metricAlertRules.workspaceId, actor.workspaceId)),
      )
      .returning();
    await this.db
      .update(integrations)
      .set({
        name: updated!.name,
        config: { kind: 'metric_alert', escalationPolicyId: updated!.escalationPolicyId },
      })
      .where(
        and(eq(integrations.id, rule.sourceId), eq(integrations.workspaceId, actor.workspaceId)),
      );
    if (reshaped) await this.resolveAll(rule);
    await this.record(actor, 'metric_alert.updated', id);
    return this.view(actor, updated!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const rule = await this.find(actor, id);
    await this.resolveAll(rule);
    await this.db
      .delete(metricAlertRules)
      .where(
        and(eq(metricAlertRules.id, rule.id), eq(metricAlertRules.workspaceId, actor.workspaceId)),
      );
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(
        and(eq(integrations.id, rule.sourceId), eq(integrations.workspaceId, actor.workspaceId)),
      );
    await this.record(actor, 'metric_alert.deleted', id);
  }

  async checkNow(actor: ActorContext, id: string): Promise<MetricAlertView> {
    await this.evaluator.evaluate(await this.find(actor, id), new Date());
    return this.view(actor, await this.find(actor, id));
  }

  private async resolveAll(rule: RuleRow): Promise<void> {
    const states = await this.db
      .select()
      .from(metricAlertStates)
      .where(eq(metricAlertStates.ruleId, rule.id));
    const now = new Date();
    for (const s of states.filter((x) => x.state === 'firing' || x.state === 'recovering'))
      await this.evaluator.notify(
        rule,
        s.seriesKey,
        'resolve',
        { note: 'rule changed or removed' },
        now,
      );
    await this.db.delete(metricAlertStates).where(eq(metricAlertStates.ruleId, rule.id));
  }

  private async view(actor: ActorContext, rule: RuleRow): Promise<MetricAlertView> {
    const states = await this.db
      .select()
      .from(metricAlertStates)
      .where(
        and(
          eq(metricAlertStates.ruleId, rule.id),
          eq(metricAlertStates.workspaceId, actor.workspaceId),
        ),
      );
    return toView(rule, states);
  }

  private async find(actor: ActorContext, id: string): Promise<RuleRow> {
    const [row] = await this.db
      .select()
      .from(metricAlertRules)
      .where(and(eq(metricAlertRules.id, id), eq(metricAlertRules.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Metric alert');
    return row;
  }

  private async checkPolicy(actor: ActorContext, id: string | null | undefined): Promise<void> {
    if (!id) return;
    const [found] = await this.db
      .select({ id: escalationPolicies.id })
      .from(escalationPolicies)
      .where(
        and(eq(escalationPolicies.id, id), eq(escalationPolicies.workspaceId, actor.workspaceId)),
      );
    if (!found) throw notFound('Escalation policy');
  }

  private record(actor: ActorContext, action: string, id: string) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'metric_alert',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {},
    });
  }
}
