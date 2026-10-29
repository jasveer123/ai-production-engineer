import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { BusinessImpact, ServiceImpact, ServiceValueInput } from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import type { ActorContext } from '../../core/common/request-context';
import { notFound } from '../../core/common/errors';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { services } from '../../core/db/schema';

type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

@Injectable()
export class BusinessService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async impact(actor: ActorContext, days: number): Promise<BusinessImpact> {
    const ws = actor.workspaceId;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const { rows } = await this.db.execute<Row>(sql`
      with failed as (
        select s.id as service_id, sp.trace_id as key, 'span' as src
        from spans sp
        join services s on s.workspace_id = sp.workspace_id
          and s.name = sp.service and s.environment = sp.environment
        where sp.workspace_id = ${ws} and sp.status_code = 2 and sp.start_time >= ${from}
        union all
        select i.service_id, coalesce(e.trace_id, e.id::text), 'event'
        from incident_events e join incidents i on i.id = e.incident_id
        where e.workspace_id = ${ws} and e.kind = 'error' and e.occurred_at >= ${from}
          and i.service_id is not null
      ),
      counts as (
        select service_id,
          count(distinct key) as failed,
          count(distinct key) filter (where src = 'span') as span_traces,
          count(*) filter (where src = 'event') as events
        from failed group by service_id
      )
      select s.id, s.name, s.environment, s.value_per_request, s.value_currency,
        coalesce(c.failed, 0) as failed, coalesce(c.span_traces, 0) as span_traces,
        coalesce(c.events, 0) as events,
        (select count(*) from incidents i where i.service_id = s.id and i.last_seen_at >= ${from})
          as incidents
      from services s left join counts c on c.service_id = s.id
      where s.workspace_id = ${ws}
      order by s.name, s.environment`);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
      services: rows.map((r): ServiceImpact => {
        const value = r.value_per_request === null ? null : Number(r.value_per_request);
        const failedRequests = num(r.failed);
        return {
          serviceId: String(r.id),
          serviceName: String(r.name),
          environment: String(r.environment),
          valuePerRequest: value,
          currency: value === null ? null : ((r.value_currency as string | null) ?? 'USD'),
          failedRequests,
          errorSpanTraces: num(r.span_traces),
          incidentErrorEvents: num(r.events),
          incidents: num(r.incidents),
          impact: value === null ? null : Math.round(failedRequests * value * 100) / 100,
        };
      }),
    };
  }

  async setValue(actor: ActorContext, serviceId: string, input: ServiceValueInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(services)
        .set({
          valuePerRequest: input.valuePerRequest === null ? null : String(input.valuePerRequest),
          valueCurrency: input.valuePerRequest === null ? null : (input.currency ?? 'USD'),
        })
        .where(and(eq(services.id, serviceId), eq(services.workspaceId, actor.workspaceId)))
        .returning({ id: services.id, name: services.name });
      if (!row) throw notFound('Service');
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'service.value_set',
          resourceType: 'service',
          resourceId: serviceId,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { name: row.name, ...input },
        },
        tx,
      );
    });
  }
}
