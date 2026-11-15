import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import type { MaintenanceInput, MaintenanceView } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  statusMaintenanceResources,
  statusMaintenances,
  statusPages,
  statusResources,
} from '../../../core/db/schema';
import type { PageContext } from './reports.service';
import { StatusOutbox } from './status-outbox.service';
import { loadMaintenances } from './status-read';

type MaintenanceRow = typeof statusMaintenances.$inferSelect;

const formatWindow = (m: MaintenanceRow) => {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: m.timezone,
  });
  return `${fmt.format(m.startsAt)} to ${fmt.format(m.endsAt)} (${m.timezone})`;
};

@Injectable()
export class MaintenanceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly outbox: StatusOutbox,
  ) {}

  list(pageId: string, now = new Date()): Promise<MaintenanceView[]> {
    return loadMaintenances(this.db, pageId, undefined, now);
  }

  async create(page: PageContext, input: MaintenanceInput): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(statusMaintenances)
        .values({ workspaceId: page.workspaceId, pageId: page.id, ...this.values(input) })
        .returning();
      await this.setResources(tx, page.id, row!.id, input.resourceIds ?? []);
      if (row!.notify) await this.notify(tx, page, row!, 'scheduled');
      return { id: row!.id };
    });
  }

  async update(page: PageContext, id: string, input: MaintenanceInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(statusMaintenances)
        .set(this.values(input))
        .where(and(eq(statusMaintenances.id, id), eq(statusMaintenances.pageId, page.id)))
        .returning();
      if (!row) throw notFound('Maintenance');
      await this.setResources(tx, page.id, id, input.resourceIds ?? []);
    });
  }

  async remove(pageId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(statusMaintenances)
      .where(and(eq(statusMaintenances.id, id), eq(statusMaintenances.pageId, pageId)))
      .returning({ id: statusMaintenances.id });
    if (!row) throw notFound('Maintenance');
  }

  async announceStarted(now = new Date()): Promise<number> {
    const due = await this.db
      .select({ id: statusMaintenances.id })
      .from(statusMaintenances)
      .where(
        and(
          eq(statusMaintenances.notify, true),
          isNull(statusMaintenances.startNotifiedAt),
          lte(statusMaintenances.startsAt, now),
          gt(statusMaintenances.endsAt, now),
        ),
      )
      .limit(50);
    let started = 0;
    for (const { id } of due) {
      const done = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .update(statusMaintenances)
          .set({ startNotifiedAt: now })
          .where(and(eq(statusMaintenances.id, id), isNull(statusMaintenances.startNotifiedAt)))
          .returning();
        if (!row) return false;
        const [page] = await tx.select().from(statusPages).where(eq(statusPages.id, row.pageId));
        if (page) await this.notify(tx, page, row, 'started');
        return true;
      });
      if (done) started += 1;
    }
    return started;
  }

  private values(input: MaintenanceInput) {
    return {
      title: input.title,
      description: input.description ?? '',
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      timezone: input.timezone ?? 'UTC',
      notify: input.notifySubscribers ?? true,
    };
  }

  private async notify(
    tx: Tx,
    page: PageContext,
    row: MaintenanceRow,
    phase: 'scheduled' | 'started',
  ) {
    const lead = phase === 'scheduled' ? 'Scheduled maintenance' : 'Maintenance has started';
    await this.outbox.enqueue(tx, {
      workspaceId: page.workspaceId,
      pageId: page.id,
      maintenanceId: row.id,
      dedupKey: `maintenance:${row.id}:${phase}`,
      subject: `[${page.name}] ${lead}: ${row.title}`,
      body: `${row.title}\n${formatWindow(row)}\n${row.description}\n\n${this.env.WEB_URL}/status/${page.slug}`,
    });
  }

  private async setResources(tx: Tx, pageId: string, id: string, resourceIds: string[]) {
    const unique = [...new Set(resourceIds)];
    if (unique.length) {
      const owned = await tx
        .select({ id: statusResources.id })
        .from(statusResources)
        .where(and(eq(statusResources.pageId, pageId), inArray(statusResources.id, unique)));
      if (owned.length !== unique.length) throw notFound('Resource');
    }
    await tx
      .delete(statusMaintenanceResources)
      .where(eq(statusMaintenanceResources.maintenanceId, id));
    if (unique.length)
      await tx
        .insert(statusMaintenanceResources)
        .values(unique.map((resourceId) => ({ maintenanceId: id, resourceId })));
  }
}
