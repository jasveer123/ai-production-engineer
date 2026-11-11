import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  HISTORY_DAYS,
  type ComponentState,
  type CreateStatusPageInput,
  type OverallStatus,
  type PostUpdateInput,
  type PublicStatus,
  type StatusComponent,
  type StatusPageView,
  type StatusUpdateView,
  type UpdateState,
  type UpdateStatusPageInput,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  integrations,
  monitorChecks,
  statusPageMonitors,
  statusPages,
  statusUpdates,
} from '../../../core/db/schema';

type PageRow = typeof statusPages.$inferSelect;
type UpdateRow = typeof statusUpdates.$inferSelect;

const DAY = 24 * 3600 * 1000;
const PUBLIC_UPDATES = 20;

const toUpdate = (row: UpdateRow): StatusUpdateView => ({
  id: row.id,
  title: row.title,
  body: row.body,
  state: row.state as UpdateState,
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class StatusService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async monitorIds(pageId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: statusPageMonitors.monitorId })
      .from(statusPageMonitors)
      .where(eq(statusPageMonitors.pageId, pageId))
      .orderBy(asc(statusPageMonitors.position));
    return rows.map((r) => r.id);
  }

  private async toView(row: PageRow): Promise<StatusPageView> {
    const updates = await this.db
      .select()
      .from(statusUpdates)
      .where(eq(statusUpdates.pageId, row.id))
      .orderBy(desc(statusUpdates.createdAt))
      .limit(PUBLIC_UPDATES);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      monitorIds: await this.monitorIds(row.id),
      updates: updates.map(toUpdate),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async setMonitors(actor: ActorContext, pageId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length) {
      const owned = await this.db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
          and(
            eq(integrations.workspaceId, actor.workspaceId),
            inArray(integrations.id, unique),
            sql`${integrations.config}->>'kind' = 'monitor'`,
          ),
        );
      if (owned.length !== unique.length) throw notFound('Monitor');
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(statusPageMonitors).where(eq(statusPageMonitors.pageId, pageId));
      if (unique.length)
        await tx
          .insert(statusPageMonitors)
          .values(unique.map((monitorId, position) => ({ pageId, monitorId, position })));
    });
  }

  private async find(actor: ActorContext, id: string): Promise<PageRow> {
    const [row] = await this.db
      .select()
      .from(statusPages)
      .where(and(eq(statusPages.id, id), eq(statusPages.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Status page');
    return row;
  }

  async list(actor: ActorContext): Promise<StatusPageView[]> {
    const rows = await this.db
      .select()
      .from(statusPages)
      .where(eq(statusPages.workspaceId, actor.workspaceId))
      .orderBy(asc(statusPages.createdAt));
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async create(actor: ActorContext, input: CreateStatusPageInput): Promise<StatusPageView> {
    const slug = input.slug.trim().toLowerCase();
    const [taken] = await this.db
      .select({ id: statusPages.id })
      .from(statusPages)
      .where(eq(statusPages.slug, slug));
    if (taken) throw new ApiException(409, 'slug_taken', 'That address is already used');
    const [row] = await this.db
      .insert(statusPages)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        slug,
        description: input.description || null,
      })
      .returning();
    await this.setMonitors(actor, row!.id, input.monitorIds ?? []);
    return this.toView(row!);
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateStatusPageInput,
  ): Promise<StatusPageView> {
    await this.find(actor, id);
    const [row] = await this.db
      .update(statusPages)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      })
      .where(eq(statusPages.id, id))
      .returning();
    if (input.monitorIds) await this.setMonitors(actor, id, input.monitorIds);
    return this.toView(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor, id);
    await this.db.delete(statusPages).where(eq(statusPages.id, id));
  }

  async postUpdate(
    actor: ActorContext,
    id: string,
    input: PostUpdateInput,
  ): Promise<StatusPageView> {
    const page = await this.find(actor, id);
    await this.db.insert(statusUpdates).values({
      workspaceId: actor.workspaceId,
      pageId: id,
      title: input.title,
      body: input.body ?? '',
      state: input.state,
    });
    return this.toView(page);
  }

  async removeUpdate(actor: ActorContext, id: string, updateId: string): Promise<void> {
    await this.find(actor, id);
    await this.db
      .delete(statusUpdates)
      .where(and(eq(statusUpdates.id, updateId), eq(statusUpdates.pageId, id)));
  }

  async publicView(slug: string, now = new Date()): Promise<PublicStatus> {
    const [page] = await this.db.select().from(statusPages).where(eq(statusPages.slug, slug));
    if (!page) throw notFound('Status page');
    const ids = await this.monitorIds(page.id);
    const monitors = ids.length
      ? await this.db.select().from(integrations).where(inArray(integrations.id, ids))
      : [];
    const since = new Date(now.getTime() - (HISTORY_DAYS - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const buckets = ids.length
      ? await this.db
          .select({
            monitorId: monitorChecks.monitorId,
            day: sql<string>`to_char(date_trunc('day', ${monitorChecks.checkedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
            total: sql<number>`count(*)::int`,
            ok: sql<number>`(count(*) filter (where ${monitorChecks.ok}))::int`,
          })
          .from(monitorChecks)
          .where(and(inArray(monitorChecks.monitorId, ids), gte(monitorChecks.checkedAt, since)))
          .groupBy(monitorChecks.monitorId, sql`2`)
      : [];

    const dates = Array.from({ length: HISTORY_DAYS }, (_, i) =>
      new Date(since.getTime() + i * DAY).toISOString().slice(0, 10),
    );
    const components: StatusComponent[] = ids.flatMap((id) => {
      const monitor = monitors.find((m) => m.id === id);
      if (!monitor) return [];
      const config = monitor.config as { state?: ComponentState };
      const mine = buckets.filter((b) => b.monitorId === id);
      const total = mine.reduce((sum, b) => sum + b.total, 0);
      const okCount = mine.reduce((sum, b) => sum + b.ok, 0);
      return [
        {
          name: monitor.name,
          state: config.state ?? 'pending',
          uptime: total ? Math.round((okCount / total) * 10_000) / 100 : null,
          days: dates.map((date) => {
            const b = mine.find((x) => x.day === date);
            return { date, uptime: b ? Math.round((b.ok / b.total) * 10_000) / 100 : null };
          }),
        },
      ];
    });

    const down = components.filter((c) => c.state === 'down').length;
    const overall: OverallStatus =
      down === 0 ? 'operational' : down === components.length ? 'outage' : 'degraded';
    const updates = await this.db
      .select()
      .from(statusUpdates)
      .where(eq(statusUpdates.pageId, page.id))
      .orderBy(desc(statusUpdates.createdAt))
      .limit(PUBLIC_UPDATES);
    return {
      name: page.name,
      description: page.description,
      overall,
      components,
      updates: updates.map(toUpdate),
      generatedAt: now.toISOString(),
    };
  }
}
