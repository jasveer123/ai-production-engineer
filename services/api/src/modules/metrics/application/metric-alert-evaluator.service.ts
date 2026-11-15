import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type {
  MetricAlertCondition,
  MetricAlertQuery,
  MetricAlertState,
  MissingDataPolicy,
} from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { integrations, metricAlertRules, metricAlertStates } from '../../../core/db/schema';
import { AlertSourcesService } from '../../alerts/application/alert-sources.service';
import {
  decide,
  signalOf,
  windowsNeeded,
  type SeriesState,
  type SignalResult,
} from '../domain/alert-decision';
import { MetricQueryService } from './metric-query.service';

export type RuleRow = typeof metricAlertRules.$inferSelect;
type StateRow = typeof metricAlertStates.$inferSelect;

const LEASE_SECONDS = 120;
const CLAIM_LIMIT = 50;
export const WHOLE_QUERY = '*';

@Injectable()
export class MetricAlertEvaluator {
  private readonly logger = new Logger(MetricAlertEvaluator.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly query: MetricQueryService,
    private readonly sources: AlertSourcesService,
  ) {}

  /** Claims due rules with a lease (skip locked), so concurrent workers never evaluate the same rule. */
  async runDue(now = new Date()): Promise<number> {
    const claimed = await this.db.execute<{ id: string }>(sql`
      update ${metricAlertRules} set
        lease_until = ${now.toISOString()}::timestamptz + make_interval(secs => ${LEASE_SECONDS}),
        next_eval_at = ${now.toISOString()}::timestamptz + make_interval(secs => every_seconds)
      where id in (
        select id from ${metricAlertRules}
        where paused = false and next_eval_at <= ${now.toISOString()}::timestamptz
          and (lease_until is null or lease_until < ${now.toISOString()}::timestamptz)
        order by next_eval_at limit ${CLAIM_LIMIT}
        for update skip locked
      )
      returning id`);
    for (const { id } of claimed.rows) {
      const [rule] = await this.db
        .select()
        .from(metricAlertRules)
        .where(eq(metricAlertRules.id, id));
      if (rule) await this.evaluate(rule, now).catch((err: unknown) => this.logger.error(err));
    }
    return claimed.rows.length;
  }

  async evaluate(rule: RuleRow, now: Date): Promise<void> {
    const signals = await this.signals(rule, now).catch((err: Error) => err);
    const states = await this.db
      .select()
      .from(metricAlertStates)
      .where(eq(metricAlertStates.ruleId, rule.id));
    const byKey = new Map(states.map((s) => [s.seriesKey, s]));
    const results =
      signals instanceof Error
        ? new Map(
            [...byKey.keys(), WHOLE_QUERY].map((k) => [
              k,
              { signal: 'error' as const, value: null, note: signals.message.slice(0, 300) },
            ]),
          )
        : signals;
    for (const key of byKey.keys())
      if (!results.has(key))
        results.set(key, { signal: 'no_data', value: null, note: 'series disappeared' });
    for (const [key, result] of results) await this.apply(rule, key, byKey.get(key), result, now);
    await this.db
      .update(metricAlertRules)
      .set({
        leaseUntil: null,
        lastEvaluatedAt: now,
        lastError: signals instanceof Error ? signals.message.slice(0, 500) : null,
      })
      .where(eq(metricAlertRules.id, rule.id));
  }

  private async signals(rule: RuleRow, now: Date): Promise<Map<string, SignalResult>> {
    const condition = rule.condition as unknown as MetricAlertCondition;
    const q = rule.query as unknown as MetricAlertQuery;
    const windows = windowsNeeded(condition);
    const bucketMs = rule.windowMinutes * 60_000;
    const grid = { from: now.getTime() - windows * bucketMs, bucketMs, buckets: windows };
    const perSeries = rule.perSeries && Boolean(q.groupBy);
    const result = await this.query.run(
      rule.workspaceId,
      { ...q, groupBy: perSeries ? q.groupBy : undefined },
      grid,
    );
    const out = new Map<string, SignalResult>();
    if (perSeries)
      for (const [key, values] of result.groups) out.set(key, signalOf(values, condition));
    else out.set(WHOLE_QUERY, signalOf(result.total ?? Array<null>(windows).fill(null), condition));
    return out;
  }

  private async apply(
    rule: RuleRow,
    key: string,
    row: StateRow | undefined,
    result: SignalResult,
    now: Date,
  ): Promise<void> {
    const prev: SeriesState = row
      ? { state: row.state as MetricAlertState, since: row.since, pendingSince: row.pendingSince }
      : { state: 'ok', since: now, pendingSince: null };
    const { next, transition } = decide(
      prev,
      result.signal,
      {
        confirmationSeconds: rule.confirmationSeconds,
        recoverySeconds: rule.recoverySeconds,
        missingData: rule.missingData as MissingDataPolicy,
      },
      now,
    );
    const values = {
      state: next.state,
      since: next.since,
      pendingSince: next.pendingSince,
      lastValue: result.value,
      lastObservation: result.note,
      lastEvaluatedAt: now,
    };
    await this.db
      .insert(metricAlertStates)
      .values({ ...values, workspaceId: rule.workspaceId, ruleId: rule.id, seriesKey: key })
      .onConflictDoUpdate({
        target: [metricAlertStates.ruleId, metricAlertStates.seriesKey],
        set: values,
      });
    if (transition) await this.notify(rule, key, transition, result, now);
  }

  async notify(
    rule: RuleRow,
    key: string,
    transition: 'fire' | 'resolve',
    result: Pick<SignalResult, 'note'>,
    now: Date,
  ): Promise<void> {
    const [source] = await this.db
      .select()
      .from(integrations)
      .where(
        and(eq(integrations.id, rule.sourceId), eq(integrations.workspaceId, rule.workspaceId)),
      );
    if (!source) return;
    const q = rule.query as unknown as MetricAlertQuery;
    await this.sources.buffer(
      source,
      `metric-alert-${rule.id}-${key}-${transition}-${now.toISOString()}`,
      {
        status: transition === 'fire' ? 'firing' : 'resolved',
        name: rule.name,
        severity: rule.severity,
        series: key,
        reason: `${q.agg}(${q.metric}) over ${rule.windowMinutes}m: ${result.note}`,
        labels: {
          metric: q.metric,
          ...(q.service ? { service: q.service } : {}),
          ...(key !== WHOLE_QUERY && q.groupBy ? { [q.groupBy]: key } : {}),
        },
      },
      false,
    );
  }
}
