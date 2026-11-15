import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type {
  CreateReportInput,
  CreatedReport,
  EditReportInput,
  EditUpdateInput,
  Impact,
  ReportUpdateInput,
  ReportView,
  UpdateState,
} from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  statusReportResources,
  statusReports,
  statusResources,
  statusUpdates,
} from '../../../core/db/schema';
import { StatusOutbox } from './status-outbox.service';
import { loadReports, type Db } from './status-read';

export interface PageContext {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
}

type Affected = { resourceId: string; impact: Impact }[];

export interface ThreadEntry {
  reportId: string;
  title: string;
  body: string;
  state: UpdateState;
  auto?: boolean;
  notify: boolean;
  deliverAfter?: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly outbox: StatusOutbox,
  ) {}

  list(pageId: string): Promise<ReportView[]> {
    return loadReports(this.db, pageId, undefined, 100);
  }

  async create(page: PageContext, input: CreateReportInput): Promise<CreatedReport> {
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date();
    const state = input.state ?? 'investigating';
    const notify = input.notifySubscribers ?? true;
    const id = await this.db.transaction(async (tx) => {
      const [report] = await tx
        .insert(statusReports)
        .values({
          workspaceId: page.workspaceId,
          pageId: page.id,
          title: input.title,
          state,
          publishedAt,
          resolvedAt: state === 'resolved' ? publishedAt : null,
        })
        .returning({ id: statusReports.id });
      await this.setAffected(tx, page.id, report!.id, input.affected ?? []);
      await this.appendUpdate(tx, page, {
        reportId: report!.id,
        title: input.title,
        body: input.body || input.title,
        state,
        notify,
        deliverAfter: publishedAt,
      });
      return report!.id;
    });
    return { id, fanout: notify ? 'queued' : 'skipped' };
  }

  async addUpdate(
    page: PageContext,
    reportId: string,
    input: ReportUpdateInput,
  ): Promise<CreatedReport> {
    const notify = input.notifySubscribers ?? true;
    await this.db.transaction(async (tx) => {
      const report = await this.find(tx, page.id, reportId);
      const resolved = input.state === 'resolved';
      await tx
        .update(statusReports)
        .set({
          state: input.state,
          resolvedAt: resolved ? (report.resolvedAt ?? new Date()) : null,
        })
        .where(eq(statusReports.id, reportId));
      if (input.affected) await this.setAffected(tx, page.id, reportId, input.affected);
      else if (resolved)
        await tx
          .update(statusReportResources)
          .set({ impact: 'resolved' })
          .where(eq(statusReportResources.reportId, reportId));
      await this.appendUpdate(tx, page, {
        reportId,
        title: report.title,
        body: input.body,
        state: input.state,
        notify,
        deliverAfter: report.publishedAt,
      });
    });
    return { id: reportId, fanout: notify ? 'queued' : 'skipped' };
  }

  async edit(page: PageContext, reportId: string, input: EditReportInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.find(tx, page.id, reportId);
      if (input.title || input.publishedAt)
        await tx
          .update(statusReports)
          .set({
            ...(input.title ? { title: input.title } : {}),
            ...(input.publishedAt ? { publishedAt: new Date(input.publishedAt) } : {}),
          })
          .where(eq(statusReports.id, reportId));
      if (input.affected) await this.setAffected(tx, page.id, reportId, input.affected);
    });
  }

  async editUpdate(pageId: string, reportId: string, updateId: string, input: EditUpdateInput) {
    const [row] = await this.db
      .update(statusUpdates)
      .set({ body: input.body })
      .where(
        and(
          eq(statusUpdates.id, updateId),
          eq(statusUpdates.reportId, reportId),
          eq(statusUpdates.pageId, pageId),
        ),
      )
      .returning({ id: statusUpdates.id });
    if (!row) throw notFound('Update');
  }

  async remove(pageId: string, reportId: string): Promise<void> {
    const [row] = await this.db
      .delete(statusReports)
      .where(and(eq(statusReports.id, reportId), eq(statusReports.pageId, pageId)))
      .returning({ id: statusReports.id });
    if (!row) throw notFound('Status update');
  }

  async removeUpdate(pageId: string, reportId: string, updateId: string): Promise<void> {
    const [row] = await this.db
      .delete(statusUpdates)
      .where(
        and(
          eq(statusUpdates.id, updateId),
          eq(statusUpdates.reportId, reportId),
          eq(statusUpdates.pageId, pageId),
        ),
      )
      .returning({ id: statusUpdates.id });
    if (!row) throw notFound('Update');
  }

  async appendUpdate(db: Db, page: PageContext, entry: ThreadEntry): Promise<string> {
    const [update] = await db
      .insert(statusUpdates)
      .values({
        workspaceId: page.workspaceId,
        pageId: page.id,
        reportId: entry.reportId,
        title: entry.title,
        body: entry.body,
        state: entry.state,
        auto: entry.auto ?? false,
      })
      .returning({ id: statusUpdates.id });
    if (entry.notify)
      await this.outbox.enqueue(db, {
        workspaceId: page.workspaceId,
        pageId: page.id,
        reportId: entry.reportId,
        dedupKey: `report:${entry.reportId}:update:${update!.id}`,
        subject: `[${page.name}] ${entry.state}: ${entry.title}`,
        body: `${entry.title}\n${entry.body}\n\nStatus: ${entry.state}\n${this.env.WEB_URL}/status/${page.slug}`,
        deliverAfter: entry.deliverAfter,
      });
    return update!.id;
  }

  async setAffected(db: Db, pageId: string, reportId: string, affected: Affected): Promise<void> {
    const unique = [...new Map(affected.map((a) => [a.resourceId, a])).values()];
    if (unique.length) {
      const owned = await db
        .select({ id: statusResources.id })
        .from(statusResources)
        .where(
          and(
            eq(statusResources.pageId, pageId),
            inArray(
              statusResources.id,
              unique.map((a) => a.resourceId),
            ),
          ),
        );
      if (owned.length !== unique.length) throw notFound('Resource');
    }
    await db.delete(statusReportResources).where(eq(statusReportResources.reportId, reportId));
    if (unique.length)
      await db
        .insert(statusReportResources)
        .values(unique.map((a) => ({ reportId, resourceId: a.resourceId, impact: a.impact })));
  }

  private async find(tx: Tx, pageId: string, reportId: string) {
    const [row] = await tx
      .select()
      .from(statusReports)
      .where(and(eq(statusReports.id, reportId), eq(statusReports.pageId, pageId)))
      .for('update');
    if (!row) throw notFound('Status update');
    return row;
  }
}
