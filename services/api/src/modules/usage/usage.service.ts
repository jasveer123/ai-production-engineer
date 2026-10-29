import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { UsageMonth, UsageSummary, WorkspaceLimits } from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import type { ActorContext } from '../../core/common/request-context';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { incidentEvents, workspaces } from '../../core/db/schema';

type Executor = Pick<Database, 'execute' | 'insert' | 'select'>;
type Row = Record<string, unknown>;
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

const RUNNING = sql`status in ('collecting_evidence', 'analyzing') and started_at > now() - interval '1 hour'`;

@Injectable()
export class UsageService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async limits(workspaceId: string, db: Executor = this.db): Promise<WorkspaceLimits> {
    const [ws] = await db
      .select({ budget: workspaces.aiBudgetUsd, max: workspaces.maxConcurrentInvestigations })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    return {
      monthlyAiBudgetUsd: ws?.budget == null ? null : Number(ws.budget),
      maxConcurrentInvestigations: ws?.max ?? null,
    };
  }

  private async running(workspaceId: string, db: Executor): Promise<number> {
    const { rows } = await db.execute<Row>(
      sql`select count(*) as n from investigations where workspace_id = ${workspaceId} and ${RUNNING}`,
    );
    return num(rows[0]?.n);
  }

  private async monthCost(workspaceId: string, db: Executor): Promise<number> {
    const { rows } = await db.execute<Row>(sql`
      select coalesce(sum(quantity), 0) as usd from usage_records
      where workspace_id = ${workspaceId} and metric = 'model_cost_usd'
        and recorded_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`);
    return num(rows[0]?.usd);
  }

  async blockedReason(workspaceId: string, db: Executor = this.db): Promise<string | null> {
    const limits = await this.limits(workspaceId, db);
    if (limits.monthlyAiBudgetUsd !== null) {
      const used = await this.monthCost(workspaceId, db);
      if (used >= limits.monthlyAiBudgetUsd) {
        return `the monthly AI budget of $${limits.monthlyAiBudgetUsd.toFixed(2)} is used up ($${used.toFixed(2)} this month). An owner can raise it under Settings → Usage.`;
      }
    }
    if (limits.maxConcurrentInvestigations !== null) {
      const running = await this.running(workspaceId, db);
      if (running >= limits.maxConcurrentInvestigations) {
        return `${running} investigation${running === 1 ? ' is' : 's are'} already running (limit ${limits.maxConcurrentInvestigations}). Try again when one finishes, or an owner can raise the limit under Settings → Usage.`;
      }
    }
    return null;
  }

  async recordBlocked(
    input: {
      workspaceId: string;
      incidentId: string;
      reason: string;
      actorId: string | null;
      correlationId: string;
    },
    db: Executor = this.db,
  ): Promise<void> {
    await db.insert(incidentEvents).values({
      workspaceId: input.workspaceId,
      incidentId: input.incidentId,
      kind: 'investigation',
      source: 'usage_limit',
      occurredAt: new Date(),
      actorId: input.actorId,
      summary: `AI investigation not started: ${input.reason}`,
      attributes: { status: 'blocked', reason: input.reason },
    });
    await this.audit.record(
      {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        actorType: input.actorId ? 'user' : 'system',
        action: 'investigation.blocked',
        resourceType: 'incident',
        resourceId: input.incidentId,
        outcome: 'denied',
        correlationId: input.correlationId,
        metadata: { reason: input.reason },
      },
      db,
    );
  }

  async summary(actor: ActorContext): Promise<UsageSummary> {
    const ws = actor.workspaceId;
    const { rows } = await this.db.execute<Row>(sql`
      with months as (
        select to_char(m, 'YYYY-MM') as month from generate_series(
          date_trunc('month', now() at time zone 'utc') - interval '5 months',
          date_trunc('month', now() at time zone 'utc'), interval '1 month') m
      )
      select months.month,
        coalesce(sum(u.quantity) filter (where u.metric = 'investigations'), 0) as investigations,
        coalesce(sum(u.quantity) filter (where u.metric = 'model_input_tokens'), 0) as input_tokens,
        coalesce(sum(u.quantity) filter (where u.metric = 'model_output_tokens'), 0) as output_tokens,
        coalesce(sum(u.quantity) filter (where u.metric = 'model_cost_usd'), 0) as cost_usd,
        coalesce(sum(u.quantity) filter (where u.metric = 'sandbox_seconds'), 0) as sandbox_seconds
      from months left join usage_records u
        on u.workspace_id = ${ws} and to_char(u.recorded_at at time zone 'utc', 'YYYY-MM') = months.month
      group by months.month order by months.month desc`);
    const months = rows.map((r): UsageMonth => ({
      month: String(r.month),
      investigations: num(r.investigations),
      inputTokens: num(r.input_tokens),
      outputTokens: num(r.output_tokens),
      aiCostUsd: Math.round(num(r.cost_usd) * 10_000) / 10_000,
      sandboxMinutes: Math.round(num(r.sandbox_seconds) / 6) / 10,
    }));
    return {
      months,
      limits: await this.limits(ws),
      runningInvestigations: await this.running(ws, this.db),
      blockedReason: await this.blockedReason(ws),
    };
  }

  async setLimits(actor: ActorContext, input: WorkspaceLimits): Promise<UsageSummary> {
    await this.db.transaction(async (tx) => {
      const before = await this.limits(actor.workspaceId, tx);
      await tx
        .update(workspaces)
        .set({
          aiBudgetUsd: input.monthlyAiBudgetUsd === null ? null : String(input.monthlyAiBudgetUsd),
          maxConcurrentInvestigations: input.maxConcurrentInvestigations,
        })
        .where(eq(workspaces.id, actor.workspaceId));
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'workspace.limits_updated',
          resourceType: 'workspace',
          resourceId: actor.workspaceId,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { before, after: input },
        },
        tx,
      );
    });
    return this.summary(actor);
  }
}
