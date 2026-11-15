import { Injectable } from '@nestjs/common';
import { and, count, eq, notInArray, sql } from 'drizzle-orm';
import { CLOSED_STATUSES } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import type { Tx } from '../../../core/db/client';
import {
  alertRoutes,
  alerts,
  incidentEvents,
  incidents,
  inboundEvents,
  services,
} from '../../../core/db/schema';
import { openIncident } from '../../../ingest/ingestion/infrastructure/open-incident';
import { planResponse, stopRuns } from '../../incidents';
import { parseAlerts, type ParsedAlert } from '../domain/parsers';
import { groupFingerprint, groupKey, groupReason, matchRoute } from '../domain/routing';

type InboundRow = typeof inboundEvents.$inferSelect;
type RouteRow = typeof alertRoutes.$inferSelect;
type AlertRow = typeof alerts.$inferSelect;

export const ALERT_SOURCE_PREFIX = 'alert:';

// Serialises concurrent deliveries for the same alert or incident group until commit.
const lock = (tx: Tx, key: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);

// First-party checks always open an incident, as Better Stack does; any alert does while no route covers its source.
const BUILT_IN_ROUTE_KINDS = new Set(['monitor', 'heartbeat', 'metric_alert', 'log_alert']);

function builtInRoute(kind: string, row: InboundRow, hasRoutes: boolean): RouteRow | null {
  if (hasRoutes && !BUILT_IN_ROUTE_KINDS.has(kind)) return null;
  return {
    id: `builtin:${kind}`,
    workspaceId: row.workspaceId,
    name: 'Built-in rule for checks',
    position: Number.MAX_SAFE_INTEGER,
    enabled: true,
    sourceIds: [],
    conditions: [],
    groupBy: [],
    createIncident: true,
    incidentSeverity: null,
    createdAt: row.receivedAt,
    updatedAt: row.receivedAt,
  };
}

async function autoResolve(tx: Tx, incidentId: string, at: Date): Promise<void> {
  const [row] = await tx.select().from(incidents).where(eq(incidents.id, incidentId)).for('update');
  if (!row) return;
  const plan = planResponse(row, 'resolve');
  if (!plan.ok) return;
  await tx
    .update(incidents)
    .set({
      resolvedAt: at,
      resolvedBy: null,
      resolutionOrigin: 'automatic',
      resolutionReason: 'Every alert on this incident recovered',
      version: row.version + 1,
      ...(plan.aiStatus ? { status: plan.aiStatus } : {}),
    })
    .where(eq(incidents.id, row.id));
  await tx.insert(incidentEvents).values({
    workspaceId: row.workspaceId,
    incidentId: row.id,
    kind: 'resolved',
    source: 'system',
    occurredAt: at,
    summary: 'Incident resolved automatically',
    attributes: {
      origin: 'automatic',
      ...(plan.aiStatus ? { from: row.status, to: plan.aiStatus } : {}),
    },
  });
  await stopRuns(tx, row.workspaceId, row.id, 'cancelled');
}

interface AlertIntake {
  row: InboundRow;
  kind: string;
  routes: RouteRow[];
}

interface IncidentGroup {
  row: InboundRow;
  kind: string;
  route: RouteRow;
  key: string;
}

@Injectable()
export class AlertProcessor {
  constructor(private readonly audit: AuditService) {}

  async apply(tx: Tx, row: InboundRow): Promise<void> {
    const kind = row.source.slice(ALERT_SOURCE_PREFIX.length);
    const parsed = parseAlerts(kind, row.payload, row.receivedAt);
    const routes = await tx
      .select()
      .from(alertRoutes)
      .where(eq(alertRoutes.workspaceId, row.workspaceId));
    for (const a of parsed) await this.one(tx, row, kind, routes, a);
  }

  private async one(tx: Tx, row: InboundRow, kind: string, routes: RouteRow[], a: ParsedAlert) {
    await lock(tx, `alert:${row.integrationId}:${a.dedupKey}`);
    const [existing] = await tx
      .select()
      .from(alerts)
      .where(and(eq(alerts.sourceId, row.integrationId), eq(alerts.dedupKey, a.dedupKey)))
      .for('update');

    if (a.status === 'resolved') return this.resolve(tx, existing, a);
    if (existing?.status === 'firing') return this.repeatFiring(tx, existing, a);
    if (existing?.resolvedAt && a.occurredAt < existing.resolvedAt) return;

    await this.fire(tx, { row, kind, routes }, a, existing);
  }

  private async resolve(tx: Tx, existing: AlertRow | undefined, a: ParsedAlert) {
    if (!existing || existing.status === 'resolved') return;
    if (a.occurredAt < existing.lastFiredAt) return;
    await tx
      .update(alerts)
      .set({ status: 'resolved', resolvedAt: a.occurredAt })
      .where(eq(alerts.id, existing.id));
    if (existing.incidentId) await this.resolvedOnIncident(tx, existing, a);
  }

  private async repeatFiring(tx: Tx, existing: AlertRow, a: ParsedAlert) {
    await tx
      .update(alerts)
      .set({
        lastFiredAt: sql`greatest(${alerts.lastFiredAt}, ${a.occurredAt.toISOString()}::timestamptz)`,
        occurrences: sql`${alerts.occurrences} + 1`,
      })
      .where(eq(alerts.id, existing.id));
  }

  private async fire(tx: Tx, intake: AlertIntake, a: ParsedAlert, existing: AlertRow | undefined) {
    const { row, kind, routes } = intake;
    const matched = matchRoute(routes, row.integrationId, a);
    const route =
      matched ??
      builtInRoute(
        kind,
        row,
        routes.some(
          (r) => r.enabled && (r.sourceIds.length === 0 || r.sourceIds.includes(row.integrationId)),
        ),
      );
    const key = route ? groupKey(route, row.integrationId, a) : null;
    const incidentId =
      route && route.createIncident
        ? await this.incidentFor(tx, { row, kind, route, key: key! }, a)
        : null;
    const values = {
      routeId: matched?.id ?? null,
      incidentId,
      status: 'firing' as const,
      title: a.title,
      description: a.description,
      severity: a.severity,
      labels: a.labels,
      sourceUrl: a.sourceUrl,
      groupKey: key,
      lastFiredAt: a.occurredAt,
      resolvedAt: null,
    };
    const [saved] = existing
      ? await tx
          .update(alerts)
          .set({ ...values, occurrences: sql`${alerts.occurrences} + 1` })
          .where(eq(alerts.id, existing.id))
          .returning()
      : await tx
          .insert(alerts)
          .values({
            ...values,
            workspaceId: row.workspaceId,
            sourceId: row.integrationId,
            dedupKey: a.dedupKey,
            firstFiredAt: a.occurredAt,
          })
          .returning();
    if (incidentId && route) {
      await tx.insert(incidentEvents).values({
        workspaceId: row.workspaceId,
        incidentId,
        integrationId: row.integrationId,
        kind: 'alert',
        source: `${ALERT_SOURCE_PREFIX}${kind}`,
        occurredAt: a.occurredAt,
        summary: `${existing ? 'Alert fired again' : 'Alert fired'}: ${a.title}`,
        sourceUrl: a.sourceUrl,
        attributes: {
          alertId: saved!.id,
          status: 'firing',
          severity: a.severity,
          labels: a.labels,
          reason: groupReason(route, key!),
        },
      });
    }
  }

  private async incidentFor(tx: Tx, group: IncidentGroup, a: ParsedAlert): Promise<string> {
    const { row, kind, route, key } = group;
    const fingerprint = groupFingerprint(route.id, key);
    await lock(tx, `incident:${row.workspaceId}:${fingerprint}`);
    const [open] = await tx
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.workspaceId, row.workspaceId),
          eq(incidents.fingerprint, fingerprint),
          notInArray(incidents.status, [...CLOSED_STATUSES]),
        ),
      )
      .for('update');
    if (open) {
      await tx
        .update(incidents)
        .set({
          eventCount: sql`${incidents.eventCount} + 1`,
          lastSeenAt: sql`greatest(${incidents.lastSeenAt}, ${a.occurredAt.toISOString()}::timestamptz)`,
        })
        .where(eq(incidents.id, open.id));
      return open.id;
    }

    const serviceName = a.labels.service ?? a.labels.service_name ?? a.labels.job ?? null;
    const environment = a.labels.env ?? a.labels.environment ?? null;
    const [service] =
      serviceName && environment
        ? await tx
            .select({ id: services.id })
            .from(services)
            .where(
              and(
                eq(services.workspaceId, row.workspaceId),
                eq(services.name, serviceName),
                eq(services.environment, environment),
              ),
            )
        : [];
    const id = await openIncident(tx, this.audit, {
      workspaceId: row.workspaceId,
      serviceId: service?.id ?? null,
      serviceName,
      environment,
      source: `${ALERT_SOURCE_PREFIX}${kind}`,
      title: a.title,
      fingerprint,
      severity: route.incidentSeverity ?? a.severity,
      occurredAt: a.occurredAt,
      summary: route.id.startsWith('builtin:')
        ? `Incident started: ${a.title}`
        : `Incident opened by alert route "${route.name}"`,
      correlationId: `ingest-${row.id}`,
    });
    await tx
      .update(incidents)
      .set({ eventCount: 1, ...(kind === 'monitor' ? { monitorId: row.integrationId } : {}) })
      .where(eq(incidents.id, id));
    return id;
  }

  private async resolvedOnIncident(tx: Tx, alert: AlertRow, a: ParsedAlert) {
    await tx.insert(incidentEvents).values({
      workspaceId: alert.workspaceId,
      incidentId: alert.incidentId!,
      integrationId: alert.sourceId,
      kind: 'alert',
      source: 'alert',
      occurredAt: a.occurredAt,
      summary: `Alert resolved: ${alert.title}`,
      sourceUrl: alert.sourceUrl,
      attributes: { alertId: alert.id, status: 'resolved' },
    });
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(alerts)
      .where(and(eq(alerts.incidentId, alert.incidentId!), eq(alerts.status, 'firing')));
    if (Number(n) === 0) {
      await tx.insert(incidentEvents).values({
        workspaceId: alert.workspaceId,
        incidentId: alert.incidentId!,
        kind: 'alert',
        source: 'alert',
        occurredAt: a.occurredAt,
        summary: 'All alerts for this incident have resolved',
        attributes: { allResolved: true },
      });
      await autoResolve(tx, alert.incidentId!, a.occurredAt);
    }
  }
}
