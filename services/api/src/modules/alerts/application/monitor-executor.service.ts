import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { inboundEvents, integrations, monitorChecks } from '../../../core/db/schema';
import { SecretStore } from '../../../core/secrets/secret-store.service';
import { inMaintenance } from '../../monitors/domain/maintenance';
import {
  readConfig,
  targetLabel,
  type MonitorRuntime,
  type StoredMonitorConfig,
} from '../../monitors/domain/monitor-config';
import { decideTransition } from '../../monitors/domain/transition';
import {
  certificateExpiry,
  checkMonitor,
  domainExpiry,
  PROBE_LOCATION,
  type CheckResult,
} from '../infrastructure/monitor-checker';
import { ALERT_SOURCE_PREFIX } from './alert-processor';
import { ALERT_SOURCE_PROVIDER } from './alert-sources.service';

type Row = typeof integrations.$inferSelect;
type Executor = Database | Tx;
export type RunOutcome = 'done' | 'stale' | 'busy';

const MAX_PARALLEL = 20;
const CLAIM_BATCH = 200;
const LEASE_GRACE_SECONDS = 30;
const EXPIRY_EVERY_HOURS = 12;
const DAY_MS = 86_400_000;

export interface MonitorAnnouncement {
  status: 'firing' | 'resolved';
  alertKey: string;
  title?: string;
  reason: string;
}

const isActiveMonitor = and(
  eq(integrations.provider, ALERT_SOURCE_PROVIDER),
  ne(integrations.status, 'disconnected'),
  sql`${integrations.config}->>'kind' = 'monitor'`,
  sql`coalesce(${integrations.config}->>'paused', 'false') <> 'true'`,
);

@Injectable()
export class MonitorExecutor {
  private readonly logger = new Logger(MonitorExecutor.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
  ) {}

  get policy() {
    return { allowPrivate: this.env.NODE_ENV !== 'production', allowHttp: true };
  }

  // A run owns the monitor through a lease (run id + deadline); only the lease holder may record a transition.
  private claim(where: SQL | undefined, now: Date): Promise<Row[]> {
    const nowText = now.toISOString();
    const due = this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          isActiveMonitor,
          where,
          sql`(${integrations.config}->>'leaseUntil' is null or (${integrations.config}->>'leaseUntil')::timestamptz < ${nowText}::timestamptz)`,
        ),
      )
      .limit(CLAIM_BATCH)
      .for('update', { skipLocked: true });
    return this.db
      .update(integrations)
      .set({
        config: sql`${integrations.config} || jsonb_build_object(
          'leaseRunId', gen_random_uuid()::text,
          'leaseUntil', (${nowText}::timestamptz + make_interval(secs =>
            coalesce((${integrations.config}->>'timeoutSeconds')::int, 30) + ${LEASE_GRACE_SECONDS}))::text)`,
      })
      .where(inArray(integrations.id, due))
      .returning();
  }

  async runDue(now = new Date()): Promise<number> {
    const due = await this.claim(
      sql`coalesce((${integrations.config}->>'nextCheckAt')::timestamptz, ${integrations.createdAt}) <= ${now.toISOString()}::timestamptz`,
      now,
    );
    for (let i = 0; i < due.length; i += MAX_PARALLEL) {
      await Promise.all(
        due
          .slice(i, i + MAX_PARALLEL)
          .map((row) => this.run(row, 'scheduled').catch((err: unknown) => this.logger.error(err))),
      );
    }
    return due.length;
  }

  async runNow(row: Row): Promise<RunOutcome> {
    const [claimed] = await this.claim(
      and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)),
      new Date(),
    );
    return claimed ? this.run(claimed, 'manual') : 'busy';
  }

  private async run(row: Row, mode: 'scheduled' | 'manual'): Promise<RunOutcome> {
    const c = readConfig(row.config, row.createdAt);
    const password = c.basicAuthSecretRef
      ? ((await this.secrets.get(row.workspaceId, c.basicAuthSecretRef)) ?? null)
      : null;
    const result = await checkMonitor(c, { policy: this.policy, basicAuthPassword: password });
    return this.db.transaction((tx) =>
      this.persist(tx, row, { runId: c.leaseRunId!, version: c.version, mode }, result),
    );
  }

  private async persist(
    tx: Tx,
    row: Row,
    run: { runId: string; version: number; mode: 'scheduled' | 'manual' },
    result: CheckResult,
  ): Promise<RunOutcome> {
    const [current] = await tx
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)))
      .for('update');
    if (!current) return 'stale';
    const c = readConfig(current.config, current.createdAt);
    if (c.leaseRunId !== run.runId) return 'stale';
    const now = new Date();
    const release = { leaseRunId: null, leaseUntil: null };
    if (current.status === 'disconnected' || c.version !== run.version || c.paused) {
      await this.patch(tx, current, { ...release, nextCheckAt: now.toISOString() });
      return 'stale';
    }
    const maintenance = inMaintenance(c.maintenance, now);
    const d = decideTransition(c, result.ok, now, { ...c, inMaintenance: maintenance });
    await tx.insert(monitorChecks).values({
      workspaceId: current.workspaceId,
      monitorId: current.id,
      checkedAt: now,
      ok: result.ok,
      statusCode: result.statusCode,
      responseMs: result.responseMs,
      error: result.error,
      region: PROBE_LOCATION,
      maintenance,
      transition: d.transition,
      timings: result.timings,
      configVersion: run.version,
    });
    const scheduled = now.getTime() + d.nextDelaySeconds * 1000;
    const existing = c.nextCheckAt ? Date.parse(c.nextCheckAt) : scheduled;
    const next = run.mode === 'scheduled' ? scheduled : Math.min(existing, scheduled);
    await this.patch(tx, current, {
      ...release,
      nextCheckAt: new Date(next).toISOString(),
      state: d.state,
      failingSince: d.failingSince,
      passingSince: d.passingSince,
      ...(d.state !== c.state ? { stateSince: now.toISOString() } : {}),
      lastCheckedAt: now.toISOString(),
      lastStatusCode: result.statusCode,
      lastResponseMs: result.responseMs,
      lastError: result.error,
    });
    if (d.transition)
      await this.announce(tx, current, c, `monitor-${run.runId}`, {
        status: d.transition === 'down' ? 'firing' : 'resolved',
        alertKey: 'monitor',
        reason: result.error ?? 'The check passed again.',
      });
    return 'done';
  }

  patch(ex: Executor, row: Row, patch: Partial<MonitorRuntime> | Record<string, unknown>) {
    return ex
      .update(integrations)
      .set({ config: sql`${integrations.config} || ${JSON.stringify(patch)}::jsonb` })
      .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
  }

  // The inbound event row is the outbox: it commits with the state change and the ingestion worker delivers it.
  async announce(
    ex: Executor,
    row: Row,
    c: StoredMonitorConfig,
    eventId: string,
    a: MonitorAnnouncement,
  ): Promise<void> {
    await ex
      .insert(inboundEvents)
      .values({
        workspaceId: row.workspaceId,
        integrationId: row.id,
        source: `${ALERT_SOURCE_PREFIX}monitor`,
        externalEventId: eventId,
        payload: {
          ...a,
          name: row.name,
          monitorId: row.id,
          target: targetLabel(c),
          metadata: Object.fromEntries(c.metadata.map((m) => [m.key, m.value])),
          escalationPolicyId: c.escalationPolicyId,
        },
      })
      .onConflictDoNothing();
  }

  async runExpiryChecks(now = new Date()): Promise<number> {
    const nextText = new Date(now.getTime() + EXPIRY_EVERY_HOURS * 3_600_000).toISOString();
    const due = await this.db
      .update(integrations)
      .set({
        config: sql`${integrations.config} || jsonb_build_object('nextExpiryCheckAt', ${nextText}::text)`,
      })
      .where(
        and(
          isActiveMonitor,
          sql`(${integrations.config}->>'sslExpiryDays' is not null or ${integrations.config}->>'domainExpiryDays' is not null)`,
          sql`coalesce((${integrations.config}->>'nextExpiryCheckAt')::timestamptz, ${integrations.createdAt}) <= ${now.toISOString()}::timestamptz`,
        ),
      )
      .returning();
    for (const row of due)
      await this.expiry(row, now).catch((err: unknown) => this.logger.warn(err));
    return due.length;
  }

  private async expiry(row: Row, now: Date): Promise<void> {
    const c = readConfig(row.config, row.createdAt);
    const host = c.url ? new URL(c.url).hostname : (c.host ?? '');
    const ssl =
      c.sslExpiryDays !== null && c.url?.startsWith('https://')
        ? await certificateExpiry(c.url, this.policy, c.timeoutSeconds)
        : null;
    const domain = c.domainExpiryDays !== null ? await domainExpiry(host) : null;
    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(integrations)
        .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)))
        .for('update');
      if (!current) return;
      const cur = readConfig(current.config, current.createdAt);
      const patch: Partial<MonitorRuntime> = {
        sslExpiresAt: ssl?.toISOString() ?? null,
        domainExpiresAt: domain?.toISOString() ?? null,
      };
      const checks = [
        {
          key: 'ssl_expiry',
          what: 'SSL certificate',
          at: ssl,
          days: cur.sslExpiryDays,
          flag: 'sslAlerting',
        },
        {
          key: 'domain_expiry',
          what: 'Domain',
          at: domain,
          days: cur.domainExpiryDays,
          flag: 'domainAlerting',
        },
      ] as const;
      for (const x of checks) {
        const alerting = Boolean(
          x.at && x.days !== null && x.at.getTime() - now.getTime() < x.days * DAY_MS,
        );
        if (alerting === cur[x.flag]) continue;
        patch[x.flag] = alerting;
        const when = x.at?.toISOString().slice(0, 10) ?? 'unknown';
        await this.announce(
          tx,
          current,
          cur,
          `${x.key}-${alerting ? 'firing' : 'resolved'}-${now.toISOString()}`,
          {
            status: alerting ? 'firing' : 'resolved',
            alertKey: x.key,
            title: `${x.what} for ${host} ${alerting ? `expires on ${when}` : 'was renewed'}`,
            reason: `${x.what} expires on ${when}.`,
          },
        );
      }
      await this.patch(tx, current, patch);
    });
  }
}
