import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { QualitySummary } from '@ape/api-contracts';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Math.round(Number(v));

/**
 * The online counterpart of the offline evaluation (ADR-021): how the platform did on this
 * workspace's real incidents, from stored outcomes only. Everything is scoped by workspace and
 * by incidents created in the window, so the funnel stages count the same incidents.
 */
@Injectable()
export class QualityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async rows(query: ReturnType<typeof sql>): Promise<Row[]> {
    return (await this.db.execute<Row>(query)).rows;
  }

  async summary(actor: ActorContext, days: number): Promise<QualitySummary> {
    const ws = actor.workspaceId;
    const since = sql`now() - make_interval(days => ${days})`;
    const scoped = sql`select id from incidents where workspace_id = ${ws} and created_at >= ${since}`;

    const [funnel] = await this.rows(sql`
      select
        (select count(*) from incidents where id in (${scoped})) as incidents,
        (select count(distinct incident_id) from investigations
           where incident_id in (${scoped}) and status = 'completed') as investigated,
        (select count(distinct incident_id) from fix_proposals
           where incident_id in (${scoped}) and status = 'validated') as fix_validated,
        (select count(distinct incident_id) from pull_requests
           where incident_id in (${scoped}) and status = 'merged') as pr_merged,
        (select count(distinct incident_id) from verification_runs
           where incident_id in (${scoped}) and outcome = 'recovered' and status = 'completed')
           as recovered`);

    const models = await this.rows(sql`
      select coalesce(i.model, 'none') as model,
        count(*) as runs,
        count(*) filter (where i.status = 'completed') as completed,
        count(*) filter (where i.status = 'needs_review') as needs_review,
        count(*) filter (where i.status = 'failed') as failed,
        coalesce(sum((i.usage->>'cost_usd')::numeric), 0) as cost_usd,
        -- Runs that never reached a model (no key, too much evidence) have no latency.
        avg(nullif((i.usage->>'latency_ms')::numeric, 0)) as avg_latency_ms,
        count(nullif((i.usage->>'latency_ms')::numeric, 0)) as timed_runs,
        coalesce(sum(jsonb_array_length(i.rejected)), 0) as rejected
      from investigations i
      where i.workspace_id = ${ws} and i.incident_id in (${scoped})
      group by 1 order by runs desc`);

    // Verdicts on hypothesis #1, one per person, attributed to the model that wrote it.
    const votes = await this.rows(sql`
      select coalesce(i.model, 'none') as model, f.verdict, count(*) as n
      from hypothesis_feedback f
      join hypotheses h on h.id = f.hypothesis_id and h.rank = 1
      join investigations i on i.id = f.investigation_id
      where f.workspace_id = ${ws} and i.incident_id in (${scoped})
      group by 1, 2`);

    const [fixes] = await this.rows(sql`
      select count(*) as total,
        count(*) filter (where status = 'validated') as validated,
        count(*) filter (where status = 'validation_failed') as validation_failed,
        count(*) filter (where status = 'not_reproduced') as not_reproduced
      from fix_proposals where workspace_id = ${ws} and incident_id in (${scoped})`);

    // The last completed window decides; earlier inconclusive windows were extended.
    const outcomes = await this.rows(sql`
      select outcome, count(*) as n from (
        select distinct on (incident_id) outcome from verification_runs
        where workspace_id = ${ws} and incident_id in (${scoped}) and status = 'completed'
          and coalesce(reason, '') not like 'Superseded%'
        order by incident_id, "window" desc, created_at desc
      ) last group by outcome`);

    const verdict = (model: string | null, v: string) =>
      votes
        .filter((r) => (model === null || r.model === model) && r.verdict === v)
        .reduce((a, r) => a + num(r.n), 0);
    const correct = verdict(null, 'correct');
    const partly = verdict(null, 'partly');
    const wrong = verdict(null, 'wrong');
    const rated = correct + partly + wrong;
    const runs = models.reduce((a, m) => a + num(m.runs), 0);
    const latencyRuns = models.filter((m) => m.avg_latency_ms !== null);
    const outcome = (o: string) => num(outcomes.find((r) => r.outcome === o)?.n);

    return {
      days,
      funnel: {
        incidents: num(funnel?.incidents),
        investigated: num(funnel?.investigated),
        fixValidated: num(funnel?.fix_validated),
        prMerged: num(funnel?.pr_merged),
        recovered: num(funnel?.recovered),
      },
      investigations: {
        runs,
        completed: models.reduce((a, m) => a + num(m.completed), 0),
        needsReview: models.reduce((a, m) => a + num(m.needs_review), 0),
        failed: models.reduce((a, m) => a + num(m.failed), 0),
        guardRejections: models.reduce((a, m) => a + num(m.rejected), 0),
        costUsd: Math.round(models.reduce((a, m) => a + num(m.cost_usd), 0) * 1e6) / 1e6,
        avgLatencyMs: latencyRuns.length
          ? Math.round(
              latencyRuns.reduce((a, m) => a + num(m.avg_latency_ms) * num(m.timed_runs), 0) /
                latencyRuns.reduce((a, m) => a + num(m.timed_runs), 0),
            )
          : null,
      },
      models: models.map((m) => {
        const model = String(m.model);
        return {
          model,
          runs: num(m.runs),
          completed: num(m.completed),
          costUsd: Math.round(num(m.cost_usd) * 1e6) / 1e6,
          avgLatencyMs: numOrNull(m.avg_latency_ms),
          top1Rated: verdict(model, 'correct') + verdict(model, 'partly') + verdict(model, 'wrong'),
          top1Correct: verdict(model, 'correct'),
        };
      }),
      feedback: {
        rated,
        correct,
        partly,
        wrong,
        top1Precision: rated ? Math.round(((correct + partly / 2) / rated) * 1000) / 1000 : null,
      },
      fixes: {
        total: num(fixes?.total),
        validated: num(fixes?.validated),
        validationFailed: num(fixes?.validation_failed),
        notReproduced: num(fixes?.not_reproduced),
      },
      verification: {
        recovered: outcome('recovered'),
        notRecovered: outcome('not_recovered'),
        inconclusive: outcome('inconclusive'),
      },
    };
  }
}
