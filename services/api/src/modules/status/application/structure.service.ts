import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import type { StructureParsed, StructureView } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import {
  integrations,
  statusPageMonitors,
  statusPages,
  statusResourceMonitors,
  statusResources,
  statusSections,
} from '../../../core/db/schema';
import { loadStructure } from './status-read';

interface PageRef {
  id: string;
  workspaceId: string;
}

@Injectable()
export class StructureService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async view(page: PageRef, now = new Date()): Promise<StructureView> {
    await this.adoptLegacyLinks(page);
    const loaded = await loadStructure(this.db, page.id, now);
    return {
      sections: loaded.sections.map((s) => ({
        id: s.id,
        name: s.name,
        resources: loaded.resources
          .filter((r) => r.sectionId === s.id)
          .map((r) => ({
            id: r.id,
            publicName: r.publicName,
            explanation: r.explanation,
            monitorIds: r.monitorIds,
            manualState: r.manualState,
            showHistory: r.showHistory,
            state: r.state,
          })),
      })),
    };
  }

  async fromMonitors(page: PageRef, monitorIds: string[]): Promise<void> {
    const ids = [...new Set(monitorIds)];
    const names = await this.ownedMonitors(page.workspaceId, ids);
    await this.save(page, {
      sections: [
        {
          name: '',
          resources: ids.map((id) => ({
            publicName: names.get(id)!,
            monitorIds: [id],
            showHistory: true,
          })),
        },
      ],
    });
  }

  async save(page: PageRef, input: StructureParsed): Promise<void> {
    const wanted = [
      ...new Set(input.sections.flatMap((s) => s.resources.flatMap((r) => r.monitorIds))),
    ];
    await this.ownedMonitors(page.workspaceId, wanted);
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: statusPages.id })
        .from(statusPages)
        .where(eq(statusPages.id, page.id))
        .for('update');
      const keptSections: string[] = [];
      const keptResources: string[] = [];
      let position = 0;
      for (const [index, section] of input.sections.entries()) {
        const sectionId = await this.upsertSection(tx, page, section.id, section.name, index);
        keptSections.push(sectionId);
        for (const resource of section.resources) {
          const values = {
            sectionId,
            publicName: resource.publicName,
            explanation: resource.explanation || null,
            manualState: resource.monitorIds.length
              ? null
              : (resource.manualState ?? 'operational'),
            showHistory: resource.showHistory,
            position: position++,
          };
          const id = await this.upsertResource(tx, page, resource.id, values);
          keptResources.push(id);
          await tx.delete(statusResourceMonitors).where(eq(statusResourceMonitors.resourceId, id));
          const monitorIds = [...new Set(resource.monitorIds)];
          if (monitorIds.length)
            await tx
              .insert(statusResourceMonitors)
              .values(monitorIds.map((monitorId) => ({ resourceId: id, monitorId })));
        }
      }
      await tx
        .delete(statusResources)
        .where(
          and(eq(statusResources.pageId, page.id), this.notIn(statusResources.id, keptResources)),
        );
      await tx
        .delete(statusSections)
        .where(
          and(eq(statusSections.pageId, page.id), this.notIn(statusSections.id, keptSections)),
        );
      await this.syncLinks(tx, page.id, wanted);
    });
  }

  private notIn(column: typeof statusResources.id | typeof statusSections.id, ids: string[]) {
    return ids.length ? notInArray(column, ids) : sql`true`;
  }

  private async upsertSection(
    tx: Tx,
    page: PageRef,
    id: string | undefined,
    name: string,
    position: number,
  ) {
    if (id) {
      const [row] = await tx
        .update(statusSections)
        .set({ name, position })
        .where(and(eq(statusSections.id, id), eq(statusSections.pageId, page.id)))
        .returning({ id: statusSections.id });
      if (row) return row.id;
    }
    const [row] = await tx
      .insert(statusSections)
      .values({ workspaceId: page.workspaceId, pageId: page.id, name, position })
      .returning({ id: statusSections.id });
    return row!.id;
  }

  private async upsertResource(
    tx: Tx,
    page: PageRef,
    id: string | undefined,
    values: Omit<typeof statusResources.$inferInsert, 'workspaceId' | 'pageId'>,
  ) {
    if (id) {
      const [row] = await tx
        .update(statusResources)
        .set(values)
        .where(and(eq(statusResources.id, id), eq(statusResources.pageId, page.id)))
        .returning({ id: statusResources.id });
      if (row) return row.id;
    }
    const [row] = await tx
      .insert(statusResources)
      .values({ ...values, workspaceId: page.workspaceId, pageId: page.id })
      .returning({ id: statusResources.id });
    return row!.id;
  }

  private async syncLinks(tx: Tx, pageId: string, monitorIds: string[]) {
    await tx
      .delete(statusPageMonitors)
      .where(
        and(
          eq(statusPageMonitors.pageId, pageId),
          monitorIds.length ? notInArray(statusPageMonitors.monitorId, monitorIds) : sql`true`,
        ),
      );
    if (monitorIds.length)
      await tx
        .insert(statusPageMonitors)
        .values(monitorIds.map((monitorId, position) => ({ pageId, monitorId, position })))
        .onConflictDoNothing();
  }

  private async ownedMonitors(workspaceId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const owned = await this.db
      .select({ id: integrations.id, name: integrations.name })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          inArray(integrations.id, ids),
          sql`${integrations.config}->>'kind' = 'monitor'`,
        ),
      );
    if (owned.length !== ids.length) throw notFound('Monitor');
    return new Map(owned.map((m) => [m.id, m.name]));
  }

  async adoptLegacyLinks(page: PageRef): Promise<void> {
    const [hasSection] = await this.db
      .select({ id: statusSections.id })
      .from(statusSections)
      .where(eq(statusSections.pageId, page.id))
      .limit(1);
    if (hasSection) return;
    const links = await this.db
      .select({ monitorId: statusPageMonitors.monitorId })
      .from(statusPageMonitors)
      .where(eq(statusPageMonitors.pageId, page.id))
      .orderBy(statusPageMonitors.position);
    if (links.length)
      await this.fromMonitors(
        page,
        links.map((l) => l.monitorId),
      );
  }
}
