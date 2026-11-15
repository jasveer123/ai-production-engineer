import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type {
  MonitorAvailability,
  MonitorBucket,
  MonitorCheckView,
  MonitorIncidentView,
} from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { incidentEvents, incidents, monitorChecks } from '../../../core/db/schema';

const HISTORY_HOURS = 24;
const HISTORY_BUCKETS = 48;
const RECENT_CHECKS = 30;
const RECENT_INCIDENTS = 20;
const PERIODS: { period: MonitorAvailability['period']; since: string }[] = [
  { period: 'today', since: `date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'` },
  { period: '7d', since: `now() - interval '7 days'` },
  { period: '30d', since: `now() - interval '30 days'` },
  { period: '365d', since: `now() - interval '365 days'` },
];

interface AvailabilityRow extends Record<string, unknown> {
  period: MonitorAvailability['period'];
  observed: number | null;
  downtime: number | null;
  incidents: number;
}

@Injectable()
export class MonitorStatsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  badgeUrl(token: string): string {
    return `${this.env.PUBLIC_API_URL.replace(/\/$/, '')}/badges/monitors/${token}.svg`;
  }

  async uptimes(workspaceId: string): Promise<Map<string, number>> {
    const since = new Date(Date.now() - HISTORY_HOURS * 3600 * 1000);
    const rows = await this.db
      .select({
        monitorId: monitorChecks.monitorId,
        total: sql<number>`count(*) filter (where not ${monitorChecks.maintenance})::int`,
        ok: sql<number>`count(*) filter (where ${monitorChecks.ok} and not ${monitorChecks.maintenance})::int`,
      })
      .from(monitorChecks)
      .where(and(eq(monitorChecks.workspaceId, workspaceId), gte(monitorChecks.checkedAt, since)))
      .groupBy(monitorChecks.monitorId);
    return new Map(
      rows.filter((r) => r.total > 0).map((r) => [r.monitorId, (r.ok / r.total) * 100]),
    );
  }

  async history(workspaceId: string, id: string): Promise<MonitorBucket[]> {
    const from = new Date(Date.now() - HISTORY_HOURS * 3600 * 1000);
    const bucketMs = (HISTORY_HOURS * 3600 * 1000) / HISTORY_BUCKETS;
    const buckets = await this.db
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
          eq(monitorChecks.workspaceId, workspaceId),
          gte(monitorChecks.checkedAt, from),
        ),
      )
      .groupBy(sql`1`);
    const byIndex = new Map(buckets.map((b) => [b.bucket, b]));
    return Array.from({ length: HISTORY_BUCKETS }, (_, i) => {
      const found = byIndex.get(i);
      return {
        at: new Date(from.getTime() + i * bucketMs).toISOString(),
        total: found?.total ?? 0,
        failures: found?.failures ?? 0,
        avgMs: found?.avgMs ?? null,
      };
    });
  }

  async recent(workspaceId: string, id: string): Promise<MonitorCheckView[]> {
    const rows = await this.db
      .select()
      .from(monitorChecks)
      .where(and(eq(monitorChecks.monitorId, id), eq(monitorChecks.workspaceId, workspaceId)))
      .orderBy(desc(monitorChecks.checkedAt))
      .limit(RECENT_CHECKS);
    return rows.map((r) => ({
      id: r.id,
      checkedAt: r.checkedAt.toISOString(),
      ok: r.ok,
      statusCode: r.statusCode,
      responseMs: r.responseMs,
      error: r.error,
      region: r.region,
      maintenance: r.maintenance,
      transition: r.transition ?? null,
      timings: r.timings ?? null,
    }));
  }

  // Each check covers the time until the next one; gaps longer than two intervals are paused or
  // unobserved time and are left out, as are checks inside the maintenance window.
  async availability(
    workspaceId: string,
    id: string,
    intervalSeconds: number,
  ): Promise<MonitorAvailability[]> {
    const periods = sql.join(
      PERIODS.map((p) => sql`(${p.period}, ${sql.raw(p.since)})`),
      sql`, `,
    );
    const result = await this.db.execute<AvailabilityRow>(sql`
      with s as (
        select checked_at, ok, maintenance, transition,
          extract(epoch from (coalesce(lead(checked_at) over (order by checked_at), now()) - checked_at)) as gap
        from ${monitorChecks}
        where monitor_id = ${id} and workspace_id = ${workspaceId}
          and checked_at >= now() - interval '365 days'
      ), c as (
        select checked_at, ok, maintenance, transition,
          case when gap > ${intervalSeconds * 2} then 0 else gap end as gap from s
      )
      select p.period,
        sum(c.gap) filter (where not c.maintenance) as observed,
        sum(c.gap) filter (where not c.maintenance and not c.ok) as downtime,
        count(c.checked_at) filter (where c.transition = 'down')::int as incidents
      from (values ${periods}) as p(period, since)
      left join c on c.checked_at >= p.since
      group by p.period`);
    const byPeriod = new Map(result.rows.map((r) => [r.period, r]));
    return PERIODS.map(({ period }) => {
      const r = byPeriod.get(period);
      const observed = Number(r?.observed ?? 0);
      const downtime = Math.round(Number(r?.downtime ?? 0));
      return {
        period,
        availability: observed > 0 ? ((observed - downtime) / observed) * 100 : null,
        downtimeSeconds: downtime,
        incidents: Number(r?.incidents ?? 0),
      };
    });
  }

  async incidents(workspaceId: string, id: string): Promise<MonitorIncidentView[]> {
    const rows = await this.db
      .selectDistinct({
        id: incidents.id,
        title: incidents.title,
        status: incidents.status,
        startedAt: incidents.firstSeenAt,
      })
      .from(incidentEvents)
      .innerJoin(incidents, eq(incidents.id, incidentEvents.incidentId))
      .where(and(eq(incidentEvents.integrationId, id), eq(incidentEvents.workspaceId, workspaceId)))
      .orderBy(desc(incidents.firstSeenAt))
      .limit(RECENT_INCIDENTS);
    return rows.map((r) => ({ ...r, startedAt: r.startedAt.toISOString() }));
  }
}
