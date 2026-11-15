import { and, asc, desc, eq, gt, inArray, isNull, lte, type SQL } from 'drizzle-orm';
import type {
  Impact,
  MaintenanceView,
  ManualState,
  ReportView,
  ResourceState,
  UpdateState,
} from '@ape/api-contracts';
import type { Database, Tx } from '../../../core/db/client';
import {
  integrations,
  statusMaintenanceResources,
  statusMaintenances,
  statusReportResources,
  statusReports,
  statusResourceMonitors,
  statusResources,
  statusSections,
  statusUpdates,
} from '../../../core/db/schema';
import { maintenancePhase, resourceState, type MonitorSnapshot } from '../domain/projection';

export type Db = Database | Tx;

export interface LoadedResource {
  id: string;
  sectionId: string | null;
  publicName: string;
  explanation: string | null;
  position: number;
  showHistory: boolean;
  manualState: ManualState | null;
  monitorIds: string[];
  state: ResourceState;
}

export interface LoadedStructure {
  sections: { id: string; name: string }[];
  resources: LoadedResource[];
  monitorNames: Map<string, string>;
}

async function activeMaintenanceResources(db: Db, pageId: string, now: Date): Promise<Set<string>> {
  const rows = await db
    .select({ resourceId: statusMaintenanceResources.resourceId })
    .from(statusMaintenanceResources)
    .innerJoin(
      statusMaintenances,
      eq(statusMaintenances.id, statusMaintenanceResources.maintenanceId),
    )
    .where(
      and(
        eq(statusMaintenances.pageId, pageId),
        lte(statusMaintenances.startsAt, now),
        gt(statusMaintenances.endsAt, now),
      ),
    );
  return new Set(rows.map((r) => r.resourceId));
}

async function openImpacts(db: Db, pageId: string, now: Date): Promise<Map<string, Impact[]>> {
  const rows = await db
    .select({ resourceId: statusReportResources.resourceId, impact: statusReportResources.impact })
    .from(statusReportResources)
    .innerJoin(statusReports, eq(statusReports.id, statusReportResources.reportId))
    .where(
      and(
        eq(statusReports.pageId, pageId),
        isNull(statusReports.resolvedAt),
        lte(statusReports.publishedAt, now),
      ),
    );
  const map = new Map<string, Impact[]>();
  for (const r of rows)
    map.set(r.resourceId, [...(map.get(r.resourceId) ?? []), r.impact as Impact]);
  return map;
}

export async function loadStructure(db: Db, pageId: string, now: Date): Promise<LoadedStructure> {
  const sections = await db
    .select({ id: statusSections.id, name: statusSections.name })
    .from(statusSections)
    .where(eq(statusSections.pageId, pageId))
    .orderBy(asc(statusSections.position));
  const rows = await db
    .select()
    .from(statusResources)
    .where(eq(statusResources.pageId, pageId))
    .orderBy(asc(statusResources.position));
  const links = rows.length
    ? await db
        .select()
        .from(statusResourceMonitors)
        .where(
          inArray(
            statusResourceMonitors.resourceId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const monitorIds = [...new Set(links.map((l) => l.monitorId))];
  const monitors = monitorIds.length
    ? await db
        .select({ id: integrations.id, name: integrations.name, config: integrations.config })
        .from(integrations)
        .where(inArray(integrations.id, monitorIds))
    : [];
  const maintenance = await activeMaintenanceResources(db, pageId, now);
  const impacts = await openImpacts(db, pageId, now);
  const snapshot = new Map(monitors.map((m) => [m.id, m.config as MonitorSnapshot]));
  const resources = rows.map((r): LoadedResource => {
    const ids = links.filter((l) => l.resourceId === r.id).map((l) => l.monitorId);
    const manualState = (r.manualState as ManualState | null) ?? null;
    return {
      id: r.id,
      sectionId: r.sectionId,
      publicName: r.publicName,
      explanation: r.explanation,
      position: r.position,
      showHistory: r.showHistory,
      manualState,
      monitorIds: ids,
      state: resourceState({
        manualState,
        monitors: ids.map((id) => snapshot.get(id)),
        inMaintenance: maintenance.has(r.id),
        openImpacts: impacts.get(r.id) ?? [],
      }),
    };
  });
  return { sections, resources, monitorNames: new Map(monitors.map((m) => [m.id, m.name])) };
}

export async function loadReports(
  db: Db,
  pageId: string,
  filter: SQL | undefined,
  limit = 50,
): Promise<ReportView[]> {
  const reports = await db
    .select()
    .from(statusReports)
    .where(and(eq(statusReports.pageId, pageId), filter))
    .orderBy(desc(statusReports.publishedAt))
    .limit(limit);
  if (reports.length === 0) return [];
  const ids = reports.map((r) => r.id);
  const updates = await db
    .select()
    .from(statusUpdates)
    .where(inArray(statusUpdates.reportId, ids))
    .orderBy(desc(statusUpdates.createdAt));
  const affected = await db
    .select({
      reportId: statusReportResources.reportId,
      resourceId: statusReportResources.resourceId,
      impact: statusReportResources.impact,
      name: statusResources.publicName,
    })
    .from(statusReportResources)
    .innerJoin(statusResources, eq(statusResources.id, statusReportResources.resourceId))
    .where(inArray(statusReportResources.reportId, ids));
  return reports.map((r) => ({
    id: r.id,
    title: r.title,
    state: r.state as UpdateState,
    auto: r.auto,
    affected: affected
      .filter((a) => a.reportId === r.id)
      .map((a) => ({ resourceId: a.resourceId, name: a.name, impact: a.impact as Impact })),
    updates: updates
      .filter((u) => u.reportId === r.id)
      .map((u) => ({
        id: u.id,
        body: u.body,
        state: u.state as UpdateState,
        createdAt: u.createdAt.toISOString(),
      })),
    publishedAt: r.publishedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
  }));
}

export async function loadMaintenances(
  db: Db,
  pageId: string,
  filter: SQL | undefined,
  now: Date,
): Promise<MaintenanceView[]> {
  const rows = await db
    .select()
    .from(statusMaintenances)
    .where(and(eq(statusMaintenances.pageId, pageId), filter))
    .orderBy(asc(statusMaintenances.startsAt))
    .limit(100);
  if (rows.length === 0) return [];
  const affected = await db
    .select({
      maintenanceId: statusMaintenanceResources.maintenanceId,
      resourceId: statusMaintenanceResources.resourceId,
      name: statusResources.publicName,
    })
    .from(statusMaintenanceResources)
    .innerJoin(statusResources, eq(statusResources.id, statusMaintenanceResources.resourceId))
    .where(
      inArray(
        statusMaintenanceResources.maintenanceId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt.toISOString(),
    timezone: m.timezone,
    phase: maintenancePhase(m.startsAt, m.endsAt, now),
    affected: affected
      .filter((a) => a.maintenanceId === m.id)
      .map((a) => ({ resourceId: a.resourceId, name: a.name })),
  }));
}
