import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { QualitySummary } from '@ape/api-contracts';
import type { ActorContext } from '../../core/common/request-context';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { buildSummary, type Row } from './domain/quality-summary';

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

    const outcomes = await this.rows(sql`
      select outcome, count(*) as n from (
        select distinct on (incident_id) outcome from verification_runs
        where workspace_id = ${ws} and incident_id in (${scoped}) and status = 'completed'
          and coalesce(reason, '') not like 'Superseded%'
        order by incident_id, "window" desc, created_at desc
      ) last group by outcome`);

    return buildSummary(days, { funnel, models, votes, fixes, outcomes });
  }
}
