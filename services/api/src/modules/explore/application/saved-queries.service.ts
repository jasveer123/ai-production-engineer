import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { CreateSavedQueryInput, SavedQuery } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { forbidden, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { savedQueries } from '../../../core/db/schema';

type Row = typeof savedQueries.$inferSelect;

const toDto = (r: Row): SavedQuery => ({
  id: r.id,
  name: r.name,
  signal: r.signal as SavedQuery['signal'],
  query: r.query,
  range: r.range,
  createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class SavedQueriesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async list(actor: ActorContext, signal?: string): Promise<SavedQuery[]> {
    const rows = await this.db
      .select()
      .from(savedQueries)
      .where(
        and(
          eq(savedQueries.workspaceId, actor.workspaceId),
          signal ? eq(savedQueries.signal, signal) : undefined,
        ),
      )
      .orderBy(desc(savedQueries.createdAt))
      .limit(200);
    return rows.map(toDto);
  }

  async create(actor: ActorContext, input: CreateSavedQueryInput): Promise<SavedQuery> {
    const [row] = await this.db
      .insert(savedQueries)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        signal: input.signal,
        query: input.query,
        range: input.range ?? '1h',
        createdBy: actor.userId,
      })
      .returning();
    await this.record(actor, 'saved_query.created', row!.id, { name: input.name });
    return toDto(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Saved query');
    if (row.createdBy !== actor.userId && actor.role !== 'admin' && actor.role !== 'owner')
      throw forbidden('Only the owner or an admin can delete this query');
    await this.db
      .delete(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.workspaceId, actor.workspaceId)));
    await this.record(actor, 'saved_query.deleted', id, { name: row.name });
  }

  private record(
    actor: ActorContext,
    action: string,
    id: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'saved_query',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata,
    });
  }
}
