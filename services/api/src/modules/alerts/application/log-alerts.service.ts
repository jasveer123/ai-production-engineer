import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, gte, ilike, inArray, ne, sql } from 'drizzle-orm';
import type {
  CreateLogAlertInput,
  LogAlertState,
  LogAlertView,
  UpdateLogAlertInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { integrations, logRecords } from '../../../core/db/schema';
import { AlertSourcesService, ALERT_SOURCE_PROVIDER } from './alert-sources.service';

type Row = typeof integrations.$inferSelect;

interface LogAlertConfig {
  kind: 'log_alert';
  levels: string[];
  service: string | null;
  contains: string | null;
  threshold: number;
  windowMinutes: number;
  severity: string;
  paused: boolean;
  state: LogAlertState;
  stateSince: string;
  nextCheckAt: string;
  lastCount: number | null;
  lastCheckedAt: string | null;
}

const EVERY_SECONDS = 60;
const isLogAlert = sql`${integrations.config}->>'kind' = 'log_alert'`;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class LogAlertsService {
  private readonly logger = new Logger(LogAlertsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sources: AlertSourcesService,
    private readonly audit: AuditService,
  ) {}

  private toView(row: Row): LogAlertView {
    const c = row.config as unknown as LogAlertConfig;
    return {
      id: row.id,
      name: row.name,
      levels: c.levels,
      service: c.service,
      contains: c.contains,
      threshold: c.threshold,
      windowMinutes: c.windowMinutes,
      severity: c.severity,
      paused: c.paused,
      state: c.state,
      stateSince: c.stateSince,
      lastCount: c.lastCount,
      lastCheckedAt: c.lastCheckedAt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async find(actor: ActorContext, id: string): Promise<Row> {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, id),
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          isLogAlert,
        ),
      );
    if (!row) throw notFound('Log alert');
    return row;
  }

  async list(actor: ActorContext): Promise<LogAlertView[]> {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          isLogAlert,
        ),
      )
      .orderBy(asc(integrations.createdAt));
    return rows.map((row) => this.toView(row));
  }

  async create(actor: ActorContext, input: Required<CreateLogAlertInput>): Promise<LogAlertView> {
    const now = new Date().toISOString();
    const config: LogAlertConfig = {
      kind: 'log_alert',
      levels: input.levels,
      service: input.service ?? null,
      contains: input.contains ?? null,
      threshold: input.threshold,
      windowMinutes: input.windowMinutes,
      severity: input.severity,
      paused: false,
      state: 'ok',
      stateSince: now,
      nextCheckAt: now,
      lastCount: null,
      lastCheckedAt: null,
    };
    const [row] = await this.db
      .insert(integrations)
      .values({
        workspaceId: actor.workspaceId,
        provider: ALERT_SOURCE_PROVIDER,
        name: input.name,
        config: config as unknown as Record<string, unknown>,
        status: 'connected',
      })
      .returning();
    await this.record(actor, 'log_alert.created', row!.id);
    return this.toView(row!);
  }

  async update(actor: ActorContext, id: string, input: UpdateLogAlertInput): Promise<LogAlertView> {
    const row = await this.find(actor, id);
    const { name, ...rest } = input;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const [updated] = await this.db
      .update(integrations)
      .set({
        ...(name ? { name } : {}),
        config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb`,
      })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)))
      .returning();
    await this.record(actor, 'log_alert.updated', id);
    return this.toView(updated!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)));
    await this.record(actor, 'log_alert.deleted', id);
  }

  async checkNow(actor: ActorContext, id: string): Promise<LogAlertView> {
    const row = await this.find(actor, id);
    await this.evaluate(row, new Date());
    return this.toView(await this.find(actor, id));
  }

  async runDue(now = new Date()): Promise<number> {
    const due = await this.db
      .update(integrations)
      .set({
        config: sql`${integrations.config} || jsonb_build_object('nextCheckAt',
          (${now.toISOString()}::timestamptz + make_interval(secs => ${EVERY_SECONDS}))::text)`,
      })
      .where(
        and(
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          isLogAlert,
          sql`coalesce(${integrations.config}->>'paused', 'false') <> 'true'`,
          sql`coalesce((${integrations.config}->>'nextCheckAt')::timestamptz, ${integrations.createdAt}) <= ${now.toISOString()}::timestamptz`,
        ),
      )
      .returning();
    for (const row of due)
      await this.evaluate(row, now).catch((err: unknown) => this.logger.error(err));
    return due.length;
  }

  private async evaluate(row: Row, now: Date): Promise<void> {
    const c = row.config as unknown as LogAlertConfig;
    const since = new Date(now.getTime() - c.windowMinutes * 60_000);
    const [counted] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(logRecords)
      .where(
        and(
          eq(logRecords.workspaceId, row.workspaceId),
          gte(logRecords.ts, since),
          inArray(logRecords.level, c.levels),
          c.service ? eq(logRecords.service, c.service) : undefined,
          c.contains ? ilike(logRecords.message, `%${escapeLike(c.contains)}%`) : undefined,
        ),
      );
    const count = counted?.n ?? 0;
    const next: LogAlertState = count >= c.threshold ? 'firing' : 'ok';
    const changed = next !== c.state;
    const patch = {
      lastCount: count,
      lastCheckedAt: now.toISOString(),
      state: next,
      ...(changed ? { stateSince: now.toISOString() } : {}),
    };
    await this.db
      .update(integrations)
      .set({ config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb` })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
    if (!changed) return;
    await this.sources.buffer(
      row,
      `log-alert-${next}-${now.toISOString()}`,
      {
        status: next === 'firing' ? 'firing' : 'resolved',
        name: row.name,
        severity: c.severity,
        service: c.service,
        reason:
          next === 'firing'
            ? `${count} matching logs in the last ${c.windowMinutes} minutes (limit ${c.threshold}).`
            : `Fewer than ${c.threshold} matching logs in the last ${c.windowMinutes} minutes.`,
      },
      false,
    );
  }

  private record(actor: ActorContext, action: string, id: string) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'log_alert',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {},
    });
  }
}
