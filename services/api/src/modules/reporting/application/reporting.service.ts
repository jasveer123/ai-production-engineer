import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lte, ne, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  IncidentsOverview,
  MonitorReportRow,
  NotificationVolumeRow,
  ReportIncidentRow,
  ReportQuery,
  ResponderReportRow,
} from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  deliveryAttempts,
  escalationNotifications,
  escalationRuns,
  incidents,
  integrations,
  monitorChecks,
  users,
} from '../../../core/db/schema';
import { closedAtSql, effectiveMonitorSql, responseStateSql } from '../../incidents';
import {
  dailySeries,
  heatmap,
  inWindow,
  isValidTimezone,
  overlapSeconds,
  responseTimes,
  type LifecycleRow,
} from '../domain/metrics';

// shortcut: reports aggregate up to 5000 incidents in memory; move to SQL aggregates beyond that
const MAX_INCIDENTS = 5000;
const ackUser = alias(users, 'ack_user');
const resolveUser = alias(users, 'resolve_user');

type Person = { id: string; name: string | null; email: string };

interface Loaded extends LifecycleRow {
  id: string;
  title: string;
  severity: string;
  monitorId: string | null;
  monitorName: string | null;
  ackBy: Person | null;
  resolver: Person | null;
  resolutionOrigin: string | null;
}

const toDate = (v: string | Date | null) => (v ? new Date(v) : null);

@Injectable()
export class ReportingService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private range(q: ReportQuery) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (!(from < to) || !isValidTimezone(q.timezone))
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invalid_range',
        'Use a valid date range and timezone',
      );
    return { from, to };
  }

  private async load(workspaceId: string, q: ReportQuery) {
    const { from, to } = this.range(q);
    const f: SQL[] = [
      eq(incidents.workspaceId, workspaceId),
      gte(incidents.firstSeenAt, from),
      lte(incidents.firstSeenAt, to),
    ];
    if (q.monitorId) f.push(sql`${effectiveMonitorSql} = ${q.monitorId}`);
    if (q.acknowledgedBy) f.push(eq(incidents.acknowledgedBy, q.acknowledgedBy));
    if (q.resolvedBy) f.push(eq(incidents.resolvedBy, q.resolvedBy));
    if (q.policyId)
      f.push(sql`exists (select 1 from escalation_runs r where r.incident_id = ${incidents.id}
        and r.policy_id = ${q.policyId} and r.workspace_id = ${workspaceId})`);
    const rows = await this.db
      .select({
        i: incidents,
        state: responseStateSql,
        closedAt: closedAtSql,
        monitorId: effectiveMonitorSql,
        monitorName: sql<
          string | null
        >`(select m.name from integrations m where m.id = ${effectiveMonitorSql})`,
        ackBy: { id: ackUser.id, name: ackUser.name, email: ackUser.email },
        resolver: { id: resolveUser.id, name: resolveUser.name, email: resolveUser.email },
      })
      .from(incidents)
      .leftJoin(ackUser, eq(ackUser.id, incidents.acknowledgedBy))
      .leftJoin(resolveUser, eq(resolveUser.id, incidents.resolvedBy))
      .where(and(...f))
      .orderBy(incidents.firstSeenAt)
      .limit(MAX_INCIDENTS + 1);
    const loaded: Loaded[] = rows.slice(0, MAX_INCIDENTS).map((r) => ({
      id: r.i.id,
      title: r.i.title,
      severity: r.i.severity,
      startedAt: r.i.firstSeenAt,
      acknowledgedAt: r.i.acknowledgedAt,
      isResolved: r.state === 'resolved',
      resolvedAt: r.state === 'resolved' ? (r.i.resolvedAt ?? toDate(r.closedAt)) : null,
      monitorId: r.monitorId,
      monitorName: r.monitorName,
      ackBy: r.ackBy,
      resolver: r.resolver,
      resolutionOrigin: r.state === 'resolved' ? (r.i.resolutionOrigin ?? 'automatic') : null,
    }));
    return {
      from,
      to,
      truncated: rows.length > MAX_INCIDENTS,
      rows: loaded.filter((r) => inWindow(r.startedAt, q)),
    };
  }

  async incidents(workspaceId: string, q: ReportQuery): Promise<IncidentsOverview> {
    const { from, to, rows, truncated } = await this.load(workspaceId, q);
    const times = responseTimes(rows);
    return {
      started: rows.length,
      ...times,
      acknowledgedShare: rows.length ? times.acknowledged / rows.length : null,
      heatmap: heatmap(rows, q.timezone),
      daily: dailySeries(rows, from, to, q.timezone),
      incidents: rows.map((r): ReportIncidentRow => ({
        id: r.id,
        title: r.title,
        severity: r.severity,
        monitorName: r.monitorName,
        startedAt: r.startedAt.toISOString(),
        acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
        acknowledgedBy: r.ackBy ? (r.ackBy.name ?? r.ackBy.email) : null,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        resolvedBy: r.resolver ? (r.resolver.name ?? r.resolver.email) : null,
        resolutionOrigin: r.resolutionOrigin,
      })),
      truncated,
    };
  }

  async monitors(workspaceId: string, q: ReportQuery): Promise<MonitorReportRow[]> {
    const { from, to, rows } = await this.load(workspaceId, q);
    const monitorFilter: SQL[] = [
      eq(integrations.workspaceId, workspaceId),
      ne(integrations.status, 'disconnected'),
      sql`${integrations.config}->>'kind' = 'monitor'`,
    ];
    if (q.monitorId) monitorFilter.push(eq(integrations.id, q.monitorId));
    const [monitors, checks] = await Promise.all([
      this.db
        .select({ id: integrations.id, name: integrations.name })
        .from(integrations)
        .where(and(...monitorFilter)),
      this.db
        .select({
          monitorId: monitorChecks.monitorId,
          total: sql<number>`count(*) filter (where not ${monitorChecks.maintenance})::int`,
          failed: sql<number>`count(*) filter (where not ${monitorChecks.ok} and not ${monitorChecks.maintenance})::int`,
        })
        .from(monitorChecks)
        .where(
          and(
            eq(monitorChecks.workspaceId, workspaceId),
            gte(monitorChecks.checkedAt, from),
            lte(monitorChecks.checkedAt, to),
          ),
        )
        .groupBy(monitorChecks.monitorId),
    ]);
    const byMonitor = new Map(checks.map((c) => [c.monitorId, c]));
    const now = new Date();
    return monitors.map((m) => {
      const mine = rows.filter((r) => r.monitorId === m.id);
      const c = byMonitor.get(m.id);
      const times = responseTimes(mine);
      return {
        monitorId: m.id,
        name: m.name,
        checks: c?.total ?? 0,
        failedChecks: c?.failed ?? 0,
        availability: c?.total ? ((c.total - c.failed) / c.total) * 100 : null,
        downtimeSeconds: Math.round(
          mine.reduce(
            (sum, r) => sum + overlapSeconds(r.startedAt, r.resolvedAt, from, to, now),
            0,
          ),
        ),
        incidents: mine.length,
        mttaSeconds: times.mttaSeconds,
        mttrSeconds: times.mttrSeconds,
      };
    });
  }

  async responders(workspaceId: string, q: ReportQuery): Promise<ResponderReportRow[]> {
    const { rows } = await this.load(workspaceId, q);
    const people = new Map<string, ResponderReportRow>();
    const entry = (p: Person | null) => {
      if (!p) return null;
      if (!people.has(p.id))
        people.set(p.id, {
          userId: p.id,
          name: p.name,
          email: p.email,
          acknowledged: 0,
          resolved: 0,
          timeSpentSeconds: 0,
        });
      return people.get(p.id)!;
    };
    for (const r of rows) {
      const acker = entry(r.ackBy);
      if (acker) {
        acker.acknowledged += 1;
        // Time spent: from taking the incident until it was resolved.
        if (r.acknowledgedAt && r.resolvedAt)
          acker.timeSpentSeconds += Math.max(
            0,
            (r.resolvedAt.getTime() - r.acknowledgedAt.getTime()) / 1000,
          );
      }
      const resolver = entry(r.resolver);
      if (resolver) resolver.resolved += 1;
    }
    return [...people.values()]
      .map((p) => ({ ...p, timeSpentSeconds: Math.round(p.timeSpentSeconds) }))
      .sort((a, b) => b.acknowledged + b.resolved - (a.acknowledged + a.resolved));
  }

  async notifications(workspaceId: string, q: ReportQuery): Promise<NotificationVolumeRow[]> {
    const { from, to } = this.range(q);
    const filtered =
      q.monitorId ||
      q.policyId ||
      q.acknowledgedBy ||
      q.resolvedBy ||
      q.businessHours ||
      q.weekdays;
    const ids = filtered ? (await this.load(workspaceId, q)).rows.map((r) => r.id) : null;
    if (ids && ids.length === 0) return [];
    const [attempts, legacy] = await Promise.all([
      this.db
        .select({
          channel: deliveryAttempts.channel,
          status: deliveryAttempts.state,
          count: sql<number>`count(*)::int`,
        })
        .from(deliveryAttempts)
        .where(
          and(
            eq(deliveryAttempts.workspaceId, workspaceId),
            gte(deliveryAttempts.createdAt, from),
            lte(deliveryAttempts.createdAt, to),
            ...(ids ? [inArray(deliveryAttempts.incidentId, ids)] : []),
          ),
        )
        .groupBy(deliveryAttempts.channel, deliveryAttempts.state),
      this.db
        .select({ status: escalationNotifications.status, count: sql<number>`count(*)::int` })
        .from(escalationNotifications)
        .innerJoin(escalationRuns, eq(escalationRuns.id, escalationNotifications.runId))
        .where(
          and(
            eq(escalationNotifications.workspaceId, workspaceId),
            gte(escalationNotifications.sentAt, from),
            lte(escalationNotifications.sentAt, to),
            ...(ids ? [inArray(escalationRuns.incidentId, ids)] : []),
          ),
        )
        .groupBy(escalationNotifications.status),
    ]);
    return [...attempts, ...legacy.map((l) => ({ channel: 'email', ...l }))].sort(
      (a, b) => b.count - a.count,
    );
  }
}
