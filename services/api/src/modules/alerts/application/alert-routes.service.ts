import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type {
  AlertListQuery,
  AlertPreview,
  AlertRoute,
  AlertRouteInput,
  AlertView,
} from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { alertRoutes, alerts, incidents, integrations } from '../../../core/db/schema';
import { PermanentIngestError } from '../../../ingest/ingestion/domain/normalize';
import { AlertSourcesService, type SourceConfig } from './alert-sources.service';
import { parseAlerts } from '../domain/parsers';
import { groupKey, matchRoute } from '../domain/routing';

type RouteRow = typeof alertRoutes.$inferSelect;

const toRoute = (r: RouteRow): AlertRoute => ({
  id: r.id,
  name: r.name,
  position: r.position,
  enabled: r.enabled,
  sourceIds: r.sourceIds,
  conditions: r.conditions,
  groupBy: r.groupBy,
  createIncident: r.createIncident,
  incidentSeverity: r.incidentSeverity,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class AlertRoutesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sources: AlertSourcesService,
    private readonly audit: AuditService,
  ) {}

  private record(actor: ActorContext, action: string, id: string, metadata = {}) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'alert_route',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }

  private async rows(workspaceId: string) {
    return this.db
      .select()
      .from(alertRoutes)
      .where(eq(alertRoutes.workspaceId, workspaceId))
      .orderBy(asc(alertRoutes.position), asc(alertRoutes.createdAt));
  }

  async list(actor: ActorContext): Promise<AlertRoute[]> {
    return (await this.rows(actor.workspaceId)).map(toRoute);
  }

  private async checkSources(actor: ActorContext, ids: string[] | undefined) {
    if (!ids?.length) return;
    const found = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.workspaceId, actor.workspaceId), inArray(integrations.id, ids)));
    if (found.length !== new Set(ids).size) throw notFound('Alert source');
  }

  async create(actor: ActorContext, input: AlertRouteInput): Promise<AlertRoute> {
    await this.checkSources(actor, input.sourceIds);
    const last = await this.rows(actor.workspaceId);
    const [row] = await this.db
      .insert(alertRoutes)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        position: (last.at(-1)?.position ?? -1) + 1,
        enabled: input.enabled ?? true,
        sourceIds: input.sourceIds ?? [],
        conditions: input.conditions ?? [],
        groupBy: input.groupBy ?? [],
        createIncident: input.createIncident ?? true,
        incidentSeverity: input.incidentSeverity ?? null,
      })
      .returning();
    await this.record(actor, 'alert_route.created', row!.id, { name: row!.name });
    return toRoute(row!);
  }

  async update(actor: ActorContext, id: string, input: Partial<AlertRouteInput>) {
    await this.checkSources(actor, input.sourceIds);
    const [row] = await this.db
      .update(alertRoutes)
      .set(input)
      .where(and(eq(alertRoutes.id, id), eq(alertRoutes.workspaceId, actor.workspaceId)))
      .returning();
    if (!row) throw notFound('Alert route');
    await this.record(actor, 'alert_route.updated', id, { changes: input });
    return toRoute(row);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const [row] = await this.db
      .delete(alertRoutes)
      .where(and(eq(alertRoutes.id, id), eq(alertRoutes.workspaceId, actor.workspaceId)))
      .returning({ id: alertRoutes.id });
    if (!row) throw notFound('Alert route');
    await this.record(actor, 'alert_route.deleted', id);
  }

  async reorder(actor: ActorContext, ids: string[]): Promise<AlertRoute[]> {
    const current = await this.rows(actor.workspaceId);
    const known = new Set(current.map((r) => r.id));
    if (ids.some((id) => !known.has(id))) throw notFound('Alert route');
    const order = [...ids, ...current.map((r) => r.id).filter((id) => !ids.includes(id))];
    await this.db.transaction(async (tx) => {
      for (const [position, id] of order.entries())
        await tx
          .update(alertRoutes)
          .set({ position })
          .where(and(eq(alertRoutes.id, id), eq(alertRoutes.workspaceId, actor.workspaceId)));
    });
    await this.record(actor, 'alert_route.reordered', actor.workspaceId, { order });
    return this.list(actor);
  }

  async preview(actor: ActorContext, sourceId: string, payload: unknown): Promise<AlertPreview> {
    const { kind } = await this.sources.sourceForPreview(actor, sourceId);
    let parsed;
    try {
      parsed = parseAlerts(kind, payload);
    } catch (err) {
      if (err instanceof PermanentIngestError) return { alerts: [], error: err.message };
      throw err;
    }
    const routes = await this.rows(actor.workspaceId);
    return {
      error: null,
      alerts: parsed.map((a) => {
        const route = matchRoute(routes, sourceId, a);
        return {
          title: a.title,
          status: a.status,
          severity: a.severity,
          dedupKey: a.dedupKey,
          labels: a.labels,
          route: route ? { id: route.id, name: route.name } : null,
          groupKey: route ? groupKey(route, sourceId, a) : null,
          createsIncident: !!route?.createIncident && a.status === 'firing',
        };
      }),
    };
  }

  async alerts(actor: ActorContext, q: AlertListQuery & { limit: number }): Promise<AlertView[]> {
    const f: SQL[] = [eq(alerts.workspaceId, actor.workspaceId)];
    if (q.status) f.push(eq(alerts.status, q.status));
    if (q.sourceId) f.push(eq(alerts.sourceId, q.sourceId));
    if (q.incidentId) f.push(eq(alerts.incidentId, q.incidentId));
    const rows = await this.db
      .select({
        a: alerts,
        sourceName: integrations.name,
        sourceConfig: integrations.config,
        routeName: alertRoutes.name,
        incidentTitle: incidents.title,
      })
      .from(alerts)
      .innerJoin(integrations, eq(integrations.id, alerts.sourceId))
      .leftJoin(alertRoutes, eq(alertRoutes.id, alerts.routeId))
      .leftJoin(incidents, eq(incidents.id, alerts.incidentId))
      .where(and(...f))
      .orderBy(desc(alerts.lastFiredAt))
      .limit(q.limit);
    return rows.map(({ a, sourceName, sourceConfig, routeName, incidentTitle }) => ({
      id: a.id,
      sourceId: a.sourceId,
      sourceName,
      sourceKind: (sourceConfig as unknown as SourceConfig).kind,
      routeId: a.routeId,
      routeName: routeName ?? null,
      incidentId: a.incidentId,
      incidentTitle: incidentTitle ?? null,
      status: a.status,
      title: a.title,
      description: a.description,
      severity: a.severity,
      labels: a.labels,
      sourceUrl: a.sourceUrl,
      occurrences: a.occurrences,
      firstFiredAt: a.firstFiredAt.toISOString(),
      lastFiredAt: a.lastFiredAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
    }));
  }
}
