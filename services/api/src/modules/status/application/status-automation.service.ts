import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  integrations,
  statusPageMonitors,
  statusPages,
  statusReportResources,
  statusReports,
  statusResourceMonitors,
  statusResources,
} from '../../../core/db/schema';
import { transitionKey } from '../domain/projection';
import { MaintenanceService } from './maintenance.service';
import { ReportsService, type PageContext } from './reports.service';
import { StatusOutbox } from './status-outbox.service';
import { loadStructure } from './status-read';

interface Transition {
  page: PageContext;
  monitorId: string;
  monitorName: string;
  from: string | null;
  to: 'up' | 'down';
  since: string;
}

@Injectable()
export class StatusAutomationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reports: ReportsService,
    private readonly maintenance: MaintenanceService,
    private readonly outbox: StatusOutbox,
  ) {}

  async tick(now = new Date()): Promise<number> {
    const posted = await this.projectTransitions(now);
    await this.maintenance.announceStarted(now);
    await this.outbox.fanOut(now);
    await this.outbox.deliver(50, now);
    return posted;
  }

  async projectTransitions(now = new Date()): Promise<number> {
    const links = await this.db
      .select({
        pageId: statusPageMonitors.pageId,
        monitorId: statusPageMonitors.monitorId,
        lastState: statusPageMonitors.lastState,
        monitorName: integrations.name,
        config: integrations.config,
        page: {
          id: statusPages.id,
          workspaceId: statusPages.workspaceId,
          name: statusPages.name,
          slug: statusPages.slug,
        },
      })
      .from(statusPageMonitors)
      .innerJoin(integrations, eq(integrations.id, statusPageMonitors.monitorId))
      .innerJoin(statusPages, eq(statusPages.id, statusPageMonitors.pageId));
    let posted = 0;
    for (const link of links) {
      const config = link.config as { state?: string; stateSince?: string };
      const to = config.state;
      if ((to !== 'up' && to !== 'down') || to === link.lastState) continue;
      const transition: Transition = {
        page: link.page,
        monitorId: link.monitorId,
        monitorName: link.monitorName,
        from: link.lastState,
        to,
        since: config.stateSince ?? now.toISOString(),
      };
      if (await this.db.transaction((tx) => this.apply(tx, transition, now))) posted += 1;
    }
    return posted;
  }

  private async apply(tx: Tx, t: Transition, now: Date): Promise<boolean> {
    const [claimed] = await tx
      .update(statusPageMonitors)
      .set({ lastState: t.to })
      .where(
        and(
          eq(statusPageMonitors.pageId, t.page.id),
          eq(statusPageMonitors.monitorId, t.monitorId),
          sql`${statusPageMonitors.lastState} is not distinct from ${t.from}`,
        ),
      )
      .returning({ pageId: statusPageMonitors.pageId });
    if (!claimed) return false;
    const affected = await this.projectResources(tx, t, now);
    if (t.from === null && t.to === 'up') return false;
    if (affected.length > 0 && affected.every((r) => r.state === 'maintenance')) return false;
    const dedupKey = `${transitionKey(t.monitorId, t.to, t.since)}`;
    return t.to === 'down'
      ? this.openReport(tx, t, affected, dedupKey, now)
      : this.resolveReport(tx, t, dedupKey, now);
  }

  private async projectResources(tx: Tx, t: Transition, now: Date) {
    const linked = await tx
      .select({ id: statusResourceMonitors.resourceId })
      .from(statusResourceMonitors)
      .innerJoin(statusResources, eq(statusResources.id, statusResourceMonitors.resourceId))
      .where(
        and(
          eq(statusResourceMonitors.monitorId, t.monitorId),
          eq(statusResources.pageId, t.page.id),
        ),
      );
    const ids = new Set(linked.map((l) => l.id));
    const structure = await loadStructure(tx, t.page.id, now);
    const affected = structure.resources.filter((r) => ids.has(r.id));
    for (const r of affected)
      await tx
        .update(statusResources)
        .set({ state: r.state, stateChangedAt: now })
        .where(eq(statusResources.id, r.id));
    return affected;
  }

  private async openReport(
    tx: Tx,
    t: Transition,
    affected: { id: string; publicName: string }[],
    dedupKey: string,
    now: Date,
  ): Promise<boolean> {
    const name = affected.map((r) => r.publicName).join(', ') || t.monitorName;
    let report = await this.openAutoReport(tx, t);
    if (!report) {
      [report] = await tx
        .insert(statusReports)
        .values({
          workspaceId: t.page.workspaceId,
          pageId: t.page.id,
          title: `${name} is down`,
          auto: true,
          monitorId: t.monitorId,
          publishedAt: now,
        })
        .returning({ id: statusReports.id, title: statusReports.title });
      if (affected.length)
        await tx
          .insert(statusReportResources)
          .values(
            affected.map((r) => ({ reportId: report!.id, resourceId: r.id, impact: 'downtime' })),
          );
    }
    await this.thread(tx, t, report!, {
      state: 'investigating',
      body: 'Our monitoring detected a problem. We are looking into it.',
      dedupKey,
      now,
    });
    return true;
  }

  private async resolveReport(
    tx: Tx,
    t: Transition,
    dedupKey: string,
    now: Date,
  ): Promise<boolean> {
    const report = await this.openAutoReport(tx, t);
    if (!report) return false;
    await tx
      .update(statusReports)
      .set({ state: 'resolved', resolvedAt: now })
      .where(eq(statusReports.id, report.id));
    await tx
      .update(statusReportResources)
      .set({ impact: 'resolved' })
      .where(eq(statusReportResources.reportId, report.id));
    await this.thread(tx, t, report, {
      state: 'resolved',
      body: 'The problem is fixed and the service is working again.',
      dedupKey,
      now,
    });
    return true;
  }

  private async thread(
    tx: Tx,
    t: Transition,
    report: { id: string; title: string },
    entry: { state: 'investigating' | 'resolved'; body: string; dedupKey: string; now: Date },
  ) {
    const { state, body, dedupKey, now } = entry;
    const title =
      state === 'resolved' ? report.title.replace(/ is down$/, ' is back up') : report.title;
    await this.reports.appendUpdate(tx, t.page, {
      reportId: report.id,
      title,
      body,
      state,
      auto: true,
      notify: false,
    });
    await this.outbox.enqueue(tx, {
      workspaceId: t.page.workspaceId,
      pageId: t.page.id,
      reportId: report.id,
      dedupKey,
      subject: `[${t.page.name}] ${state}: ${title}`,
      body: `${title}\n${body}\n\nStatus: ${state}`,
      deliverAfter: now,
    });
  }

  private async openAutoReport(tx: Tx, t: Transition) {
    const [row] = await tx
      .select({ id: statusReports.id, title: statusReports.title })
      .from(statusReports)
      .where(
        and(
          eq(statusReports.pageId, t.page.id),
          eq(statusReports.monitorId, t.monitorId),
          eq(statusReports.auto, true),
          isNull(statusReports.resolvedAt),
        ),
      )
      .limit(1);
    return row;
  }
}
