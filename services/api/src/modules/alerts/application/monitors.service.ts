import { randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, lt, ne, sql } from 'drizzle-orm';
import {
  HTTP_MONITOR_KINDS,
  MONITOR_DEFAULTS,
  monitorIssues,
  type BulkCreateMonitorsResult,
  type CreateMonitorValues,
  type MonitorDetail,
  type MonitorSettings,
  type MonitorView,
  type UpdateMonitorInput,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { checkOutboundUrl, UnsafeUrlError } from '../../../core/common/outbound-url';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { integrations, monitorChecks } from '../../../core/db/schema';
import { SecretStore } from '../../../core/secrets/secret-store.service';
import { renderBadge } from '../../monitors/domain/badge';
import {
  readConfig,
  settingsOf,
  storedSettings,
  type StoredMonitorConfig,
} from '../../monitors/domain/monitor-config';
import { toMonitorView } from '../../monitors/domain/monitor-view';
import { PROBE_LOCATION } from '../infrastructure/monitor-checker';
import { ALERT_SOURCE_PROVIDER } from './alert-sources.service';
import { MonitorExecutor } from './monitor-executor.service';
import { MonitorStatsService } from './monitor-stats.service';

type Row = typeof integrations.$inferSelect;

const RETENTION_DAYS = 400;
const BADGE_TOKEN = /^[0-9a-f]{32}$/;
const isMonitor = sql`${integrations.config}->>'kind' = 'monitor'`;
const EXPIRY_KEYS = ['url', 'host', 'sslExpiryDays', 'domainExpiryDays'] as const;

const newRuntime = (now: string) => ({
  kind: 'monitor' as const,
  paused: false,
  state: 'pending' as const,
  stateSince: now,
  failingSince: null,
  passingSince: null,
  version: 1,
  nextCheckAt: now,
  badgeToken: randomBytes(16).toString('hex'),
});

@Injectable()
export class MonitorsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly secrets: SecretStore,
    private readonly audit: AuditService,
    private readonly executor: MonitorExecutor,
    private readonly stats: MonitorStatsService,
  ) {}

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

  private async assertSafe(s: MonitorSettings): Promise<void> {
    const host = s.host?.includes(':') ? `[${s.host}]` : s.host;
    const target = HTTP_MONITOR_KINDS.includes(s.kind) ? (s.url ?? '') : `https://${host}`;
    try {
      await checkOutboundUrl(target, this.executor.policy);
    } catch (err) {
      if (err instanceof UnsafeUrlError)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'unsafe_target', err.message);
      throw err;
    }
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
      this.stats.uptimes(actor.workspaceId),
    ]);
    return rows.map((row) => toMonitorView(row, uptimes.get(row.id) ?? null));
  }

  async get(actor: ActorContext, id: string): Promise<MonitorDetail> {
    const row = await this.find(actor, id);
    const c = readConfig(row.config, row.createdAt);
    let badgeToken = c.badgeToken;
    if (!badgeToken) {
      badgeToken = randomBytes(16).toString('hex');
      await this.executor.patch(this.db, row, { badgeToken });
    }
    const ws = actor.workspaceId;
    const [history, recent, availability, incidents] = await Promise.all([
      this.stats.history(ws, id),
      this.stats.recent(ws, id),
      this.stats.availability(ws, id, c.intervalSeconds),
      this.stats.incidents(ws, id),
    ]);
    const total = history.reduce((sum, b) => sum + b.total, 0);
    const failures = history.reduce((sum, b) => sum + b.failures, 0);
    return {
      ...toMonitorView(row, total ? ((total - failures) / total) * 100 : null),
      history,
      recent,
      availability,
      incidents,
      probeLocation: PROBE_LOCATION,
      badgeUrl: this.stats.badgeUrl(badgeToken),
    };
  }

  async create(actor: ActorContext, input: CreateMonitorValues): Promise<MonitorView> {
    const { basicAuthPassword, ...settings } = input;
    await this.assertSafe(settings);
    const row = await this.db.transaction(async (tx) => {
      const basicAuthSecretRef = basicAuthPassword
        ? await this.secrets.put(actor.workspaceId, basicAuthPassword, tx)
        : null;
      const config = {
        ...storedSettings(settings),
        ...newRuntime(new Date().toISOString()),
        basicAuthSecretRef,
      };
      const [created] = await tx
        .insert(integrations)
        .values({
          workspaceId: actor.workspaceId,
          provider: ALERT_SOURCE_PROVIDER,
          name: settings.name,
          config: config,
          status: 'connected',
        })
        .returning();
      return created!;
    });
    await this.record(actor, 'monitor.created', row.id, { kind: settings.kind });
    return toMonitorView(row, null);
  }

  async bulkCreate(
    actor: ActorContext,
    urls: string[],
    intervalSeconds: number,
  ): Promise<BulkCreateMonitorsResult> {
    const result: BulkCreateMonitorsResult = { created: [], failed: [] };
    for (const url of [...new Set(urls)]) {
      const name = /^https?:\/\//i.test(url) ? new URL(url).host.slice(0, 80) : '';
      const values: CreateMonitorValues = {
        ...MONITOR_DEFAULTS,
        name,
        kind: 'http',
        url,
        intervalSeconds,
        basicAuthPassword: null,
      };
      const issue = name ? monitorIssues(values)[0] : { message: 'Use an http or https address' };
      try {
        if (issue) throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_monitor', issue.message);
        result.created.push(await this.create(actor, values));
      } catch (err) {
        result.failed.push({ url, message: (err as Error).message });
      }
    }
    return result;
  }

  async update(actor: ActorContext, id: string, input: UpdateMonitorInput): Promise<MonitorView> {
    const row = await this.find(actor, id);
    const c = readConfig(row.config, row.createdAt);
    const { paused, basicAuthPassword, ...changes } = input;
    const next: MonitorSettings = { ...settingsOf(row.name, c), ...changes };
    const issue = monitorIssues(next)[0];
    if (issue)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_monitor', issue.message, {
        path: issue.path,
      });
    if (changes.url !== undefined || changes.host !== undefined || changes.kind !== undefined)
      await this.assertSafe(next);
    const now = new Date().toISOString();
    const updated = await this.db.transaction(async (tx) => {
      const basicAuthSecretRef = await this.rotatePassword(tx, actor, c, basicAuthPassword);
      const patch = {
        ...storedSettings(next),
        basicAuthSecretRef,
        // Bumping the version fences out any check that started under the old settings.
        version: c.version + 1,
        ...(paused !== undefined ? { paused } : {}),
        ...((paused ?? c.paused) ? {} : { nextCheckAt: now }),
        ...(EXPIRY_KEYS.some((k) => changes[k] !== undefined) ? { nextExpiryCheckAt: null } : {}),
      };
      const [saved] = await tx
        .update(integrations)
        .set({
          name: next.name,
          config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb`,
        })
        .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)))
        .returning();
      return saved!;
    });
    await this.record(actor, 'monitor.updated', id, {
      fields: Object.keys(changes),
      ...(paused !== undefined ? { paused } : {}),
      ...(basicAuthPassword !== undefined ? { basicAuthPassword: 'changed' } : {}),
    });
    return toMonitorView(updated, null);
  }

  private async rotatePassword(
    tx: Tx,
    actor: ActorContext,
    c: StoredMonitorConfig,
    password: string | null | undefined,
  ): Promise<string | null> {
    if (password === undefined) return c.basicAuthSecretRef;
    if (c.basicAuthSecretRef)
      await this.secrets.delete(actor.workspaceId, c.basicAuthSecretRef, tx);
    return password ? this.secrets.put(actor.workspaceId, password, tx) : null;
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    const c = readConfig(row.config, row.createdAt);
    await this.db.transaction(async (tx) => {
      if (c.basicAuthSecretRef)
        await this.secrets.delete(actor.workspaceId, c.basicAuthSecretRef, tx);
      await tx
        .update(integrations)
        .set({ status: 'disconnected' })
        .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, actor.workspaceId)));
    });
    await this.record(actor, 'monitor.deleted', id);
  }

  async checkNow(actor: ActorContext, id: string): Promise<MonitorDetail> {
    const row = await this.find(actor, id);
    const outcome = await this.executor.runNow(row);
    if (outcome === 'busy')
      throw new ApiException(
        HttpStatus.CONFLICT,
        'check_in_progress',
        'A check for this monitor is already running. Try again in a moment.',
      );
    return this.get(actor, id);
  }

  async sendTestAlert(actor: ActorContext, id: string): Promise<void> {
    const row = await this.find(actor, id);
    const key = `test-${randomUUID()}`;
    await this.executor.announce(this.db, row, readConfig(row.config, row.createdAt), key, {
      status: 'firing',
      alertKey: key,
      title: `Test alert from monitor "${row.name}"`,
      reason: 'Sent from the monitor page to test alert routing and escalation.',
    });
    await this.record(actor, 'monitor.test_alert_sent', id);
  }

  async badge(token: string): Promise<string | null> {
    if (!BADGE_TOKEN.test(token)) return null;
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, ALERT_SOURCE_PROVIDER),
          ne(integrations.status, 'disconnected'),
          isMonitor,
          sql`${integrations.config}->>'badgeToken' = ${token}`,
        ),
      );
    if (!row) return null;
    const c = readConfig(row.config, row.createdAt);
    return renderBadge(row.name, c.paused ? 'paused' : c.state);
  }

  async purgeOld(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);
    await this.db.delete(monitorChecks).where(lt(monitorChecks.checkedAt, cutoff));
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
