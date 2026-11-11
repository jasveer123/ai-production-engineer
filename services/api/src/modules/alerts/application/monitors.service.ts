import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gte, lt, ne, sql } from 'drizzle-orm';
import type {
  CreateMonitorInput,
  MonitorBucket,
  MonitorCheckView,
  MonitorDetail,
  MonitorKind,
  MonitorState,
  MonitorView,
  UpdateMonitorInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { checkOutboundUrl, UnsafeUrlError } from '../../../core/common/outbound-url';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { integrations, monitorChecks } from '../../../core/db/schema';
import { checkMonitor, type CheckResult } from '../infrastructure/monitor-checker';
import { AlertSourcesService, ALERT_SOURCE_PROVIDER } from './alert-sources.service';

type Row = typeof integrations.$inferSelect;

interface MonitorConfig {
  kind: 'monitor';
  monitorKind: MonitorKind;
  url: string | null;
  host: string | null;
  port: number | null;
  expectedStatus: number | null;
  keyword: string | null;
  keywordMode: 'present' | 'absent';
  intervalSeconds: number;
  timeoutSeconds: number;
  confirmations: number;
  paused: boolean;
  state: MonitorState;
  stateSince: string;
  failures: number;
  nextCheckAt: string;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
}

const HISTORY_HOURS = 24;
const HISTORY_BUCKETS = 48;
const RECENT_CHECKS = 20;
const RETENTION_DAYS = 90;
const MAX_PARALLEL = 20;
const isMonitor = sql`${integrations.config}->>'kind' = 'monitor'`;

function newConfig(input: Required<CreateMonitorInput>): MonitorConfig {
  const isTcp = input.kind === 'tcp';
  const now = new Date().toISOString();
  return {
    kind: 'monitor',
    monitorKind: input.kind,
    url: isTcp ? null : (input.url ?? null),
    host: isTcp ? (input.host ?? null) : null,
    port: isTcp ? (input.port ?? null) : null,
    expectedStatus: input.kind === 'status' ? (input.expectedStatus ?? null) : null,
    keyword: input.kind === 'keyword' ? (input.keyword ?? null) : null,
    keywordMode: input.keywordMode ?? 'present',
    intervalSeconds: input.intervalSeconds,
    timeoutSeconds: input.timeoutSeconds,
    confirmations: input.confirmations,
    paused: false,
    state: 'pending',
    stateSince: now,
    failures: 0,
    nextCheckAt: now,
    lastCheckedAt: null,
    lastStatusCode: null,
    lastResponseMs: null,
    lastError: null,
  };
}

@Injectable()
export class MonitorsService {
  private readonly logger = new Logger(MonitorsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly sources: AlertSourcesService,
    private readonly audit: AuditService,
  ) {}

  private get policy() {
    return { allowPrivate: this.env.NODE_ENV !== 'production', allowHttp: true };
  }

  private toView(row: Row, uptime24h: number | null): MonitorView {
    const c = row.config as unknown as MonitorConfig;
    return {
      id: row.id,
      name: row.name,
      kind: c.monitorKind,
      url: c.url,
      host: c.host,
      port: c.port,
      expectedStatus: c.expectedStatus,
      keyword: c.keyword,
      keywordMode: c.keywordMode,
      intervalSeconds: c.intervalSeconds,
      timeoutSeconds: c.timeoutSeconds,
      confirmations: c.confirmations,
      paused: c.paused,
      state: c.state,
      stateSince: c.stateSince,
      lastCheckedAt: c.lastCheckedAt,
      lastStatusCode: c.lastStatusCode,
      lastResponseMs: c.lastResponseMs,
      lastError: c.lastError,
      uptime24h,
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
          isMonitor,
        ),
      );
    if (!row) throw notFound('Monitor');
    return row;
  }

  private async uptimes(workspaceId: string): Promise<Map<string, number>> {
    const since = new Date(Date.now() - HISTORY_HOURS * 3600 * 1000);
    const rows = await this.db
      .select({
        monitorId: monitorChecks.monitorId,
        total: sql<number>`count(*)::int`,
        ok: sql<number>`count(*) filter (where ${monitorChecks.ok})::int`,
      })
      .from(monitorChecks)
      .where(and(eq(monitorChecks.workspaceId, workspaceId), gte(monitorChecks.checkedAt, since)))
      .groupBy(monitorChecks.monitorId);
    return new Map(rows.map((r) => [r.monitorId, (r.ok / r.total) * 100]));
  }

  async list(actor: ActorContext): Promise<MonitorView[]> {
    const [rows, uptimes] = await Promise.all([
      this.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.workspaceId, actor.workspaceId),
            eq(integrations.provider, ALERT_SOURCE_PROVIDER),
            ne(integrations.status, 'disconnected'),
            isMonitor,
          ),
        )
        .orderBy(asc(integrations.createdAt)),
      this.uptimes(actor.workspaceId),
    ]);
    return rows.map((row) => this.toView(row, uptimes.get(row.id) ?? null));
  }

  async get(actor: ActorContext, id: string): Promise<MonitorDetail> {
    const row = await this.find(actor, id);
    const from = new Date(Date.now() - HISTORY_HOURS * 3600 * 1000);
    const bucketMs = (HISTORY_HOURS * 3600 * 1000) / HISTORY_BUCKETS;
    const [buckets, recent] = await Promise.all([
      this.db
        .select({
          bucket: sql<number>`least(${HISTORY_BUCKETS - 1}, floor(extract(epoch from (${monitorChecks.checkedAt} - ${from.toISOString()}::timestamptz)) * 1000 / ${bucketMs}))::int`,
          total: sql<number>`count(*)::int`,
          failures: sql<number>`count(*) filter (where not ${monitorChecks.ok})::int`,
          avgMs: sql<
            number | null
          >`round(avg(${monitorChecks.responseMs}) filter (where ${monitorChecks.ok}))::int`,
        })
        .from(monitorChecks)
        .where(
          and(
            eq(monitorChecks.monitorId, id),
            eq(monitorChecks.workspaceId, actor.workspaceId),
            gte(monitorChecks.checkedAt, from),
          ),
        )
        .groupBy(sql`1`),
      this.db
        .select()
        .from(monitorChecks)
        .where(
          and(eq(monitorChecks.monitorId, id), eq(monitorChecks.workspaceId, actor.workspaceId)),
        )
        .orderBy(desc(monitorChecks.checkedAt))
        .limit(RECENT_CHECKS),
    ]);
    const byIndex = new Map(buckets.map((b) => [b.bucket, b]));
    const history: MonitorBucket[] = Array.from({ length: HISTORY_BUCKETS }, (_, i) => {
      const found = byIndex.get(i);
      return {
        at: new Date(from.getTime() + i * bucketMs).toISOString(),
        total: found?.total ?? 0,
        failures: found?.failures ?? 0,
        avgMs: found?.avgMs ?? null,
      };
    });
    const total = buckets.reduce((sum, b) => sum + b.total, 0);
    const failures = buckets.reduce((sum, b) => sum + b.failures, 0);
    const checks: MonitorCheckView[] = recent.map((r) => ({
      id: r.id,
      checkedAt: r.checkedAt.toISOString(),
      ok: r.ok,
      statusCode: r.statusCode,
      responseMs: r.responseMs,
      error: r.error,
    }));
    return {
      ...this.toView(row, total ? ((total - failures) / total) * 100 : null),
      history,
      recent: checks,
    };
  }

  async create(actor: ActorContext, input: Required<CreateMonitorInput>): Promise<MonitorView> {
    const isTcp = input.kind === 'tcp';
    try {
      await checkOutboundUrl(isTcp ? `https://${input.host}` : (input.url ?? ''), this.policy);
    } catch (err) {
      if (err instanceof UnsafeUrlError)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'unsafe_target', err.message);
      throw err;
    }
    const config = newConfig(input);
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
    await this.record(actor, 'monitor.created', row!.id, { kind: input.kind });
    return this.toView(row!, null);
  }

  async update(actor: ActorContext, id: string, input: UpdateMonitorInput): Promise<MonitorView> {
    const row = await this.find(actor, id);
    const patch: Record<string, unknown> = {};
    for (const key of ['intervalSeconds', 'timeoutSeconds', 'confirmations', 'paused'] as const)
      if (input[key] !== undefined) patch[key] = input[key];
    const [updated] = await this.db
      .update(integrations)
      .set({
        ...(input.name ? { name: input.name } : {}),
        config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb`,
      })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)))
      .returning();
    await this.record(actor, 'monitor.updated', id, patch);
    return this.toView(updated!, null);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    await this.db
      .update(integrations)
      .set({ status: 'disconnected' })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)));
    await this.record(actor, 'monitor.deleted', id);
  }

  async checkNow(actor: ActorContext, id: string): Promise<MonitorDetail> {
    const row = await this.find(actor, id);
    await this.execute(row);
    return this.get(actor, id);
  }

  async runDue(now = new Date()): Promise<number> {
    const due = await this.db
      .update(integrations)
      .set({
        config: sql`${integrations.config} || jsonb_build_object('nextCheckAt',
          (${now.toISOString()}::timestamptz + make_interval(secs => (${integrations.config}->>'intervalSeconds')::int))::text)`,
      })
      .where(
        and(
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          isMonitor,
          sql`coalesce(${integrations.config}->>'paused', 'false') <> 'true'`,
          sql`coalesce((${integrations.config}->>'nextCheckAt')::timestamptz, ${integrations.createdAt}) <= ${now.toISOString()}::timestamptz`,
        ),
      )
      .returning();
    for (let i = 0; i < due.length; i += MAX_PARALLEL) {
      await Promise.all(
        due
          .slice(i, i + MAX_PARALLEL)
          .map((row) => this.execute(row).catch((err: unknown) => this.logger.error(err))),
      );
    }
    return due.length;
  }

  async purgeOld(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    await this.db.delete(monitorChecks).where(lt(monitorChecks.checkedAt, cutoff));
  }

  private async execute(row: Row): Promise<void> {
    const c = row.config as unknown as MonitorConfig;
    const result: CheckResult = await checkMonitor(
      {
        monitorKind: c.monitorKind,
        url: c.url,
        host: c.host,
        port: c.port,
        expectedStatus: c.expectedStatus,
        keyword: c.keyword,
        keywordMode: c.keywordMode,
        timeoutSeconds: c.timeoutSeconds,
      },
      this.policy,
    );
    const checkedAt = new Date();
    await this.db.insert(monitorChecks).values({
      workspaceId: row.workspaceId,
      monitorId: row.id,
      checkedAt,
      ok: result.ok,
      statusCode: result.statusCode,
      responseMs: result.responseMs,
      error: result.error,
    });

    const failures = result.ok ? 0 : (c.failures ?? 0) + 1;
    let state = c.state ?? 'pending';
    let transition: 'down' | 'up' | null = null;
    if (result.ok) {
      if (state === 'down') transition = 'up';
      state = 'up';
    } else if (failures >= c.confirmations && state !== 'down') {
      state = 'down';
      transition = 'down';
    }
    const patch = {
      lastCheckedAt: checkedAt.toISOString(),
      lastStatusCode: result.statusCode,
      lastResponseMs: result.responseMs,
      lastError: result.error,
      failures,
      state,
      ...(state !== c.state ? { stateSince: checkedAt.toISOString() } : {}),
    };
    await this.db
      .update(integrations)
      .set({ config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb` })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));

    if (transition) {
      await this.sources.buffer(
        row,
        `monitor-${transition}-${checkedAt.toISOString()}`,
        {
          status: transition === 'down' ? 'firing' : 'resolved',
          name: row.name,
          target: c.url ?? `${c.host}:${c.port}`,
          reason: result.error ?? 'The check passed again.',
        },
        false,
      );
    }
  }

  private record(actor: ActorContext, action: string, id: string, metadata = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'monitor',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }
}
