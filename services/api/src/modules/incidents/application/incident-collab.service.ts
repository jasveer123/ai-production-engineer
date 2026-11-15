import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Incident, IncidentMetadataInput } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { forbidden, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { incidentEvents, incidents } from '../../../core/db/schema';
import { IncidentReader } from './incident-reader';
import { IncidentResponseService } from './incident-response.service';

@Injectable()
export class IncidentCollabService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly reader: IncidentReader,
    private readonly response: IncidentResponseService,
    private readonly audit: AuditService,
  ) {}

  async addComment(actor: ActorContext, id: string, body: string): Promise<{ id: string }> {
    await this.reader.get(actor.workspaceId, id);
    const [row] = await this.db
      .insert(incidentEvents)
      .values({
        workspaceId: actor.workspaceId,
        incidentId: id,
        kind: 'comment',
        source: 'user',
        occurredAt: new Date(),
        actorId: actor.userId,
        summary: body,
      })
      .returning({ id: incidentEvents.id });
    return { id: row!.id };
  }

  private async ownComment(actor: ActorContext, id: string, commentId: string) {
    const [row] = await this.db
      .select({ actorId: incidentEvents.actorId })
      .from(incidentEvents)
      .where(
        and(
          eq(incidentEvents.id, commentId),
          eq(incidentEvents.incidentId, id),
          eq(incidentEvents.workspaceId, actor.workspaceId),
          eq(incidentEvents.kind, 'comment'),
        ),
      );
    if (!row) throw notFound('Comment');
    if (row.actorId !== actor.userId) throw forbidden('You can only change your own comments');
    return and(eq(incidentEvents.id, commentId), eq(incidentEvents.workspaceId, actor.workspaceId));
  }

  async editComment(actor: ActorContext, id: string, commentId: string, body: string) {
    const where = await this.ownComment(actor, id, commentId);
    await this.db
      .update(incidentEvents)
      .set({ summary: body, attributes: { editedAt: new Date().toISOString() } })
      .where(where);
  }

  async deleteComment(actor: ActorContext, id: string, commentId: string): Promise<void> {
    const where = await this.ownComment(actor, id, commentId);
    await this.db.delete(incidentEvents).where(where);
  }

  async savePostMortem(actor: ActorContext, id: string, body: string): Promise<Incident> {
    const text = body.trim();
    await this.db
      .update(incidents)
      .set({
        postMortem: text || null,
        postMortemUpdatedAt: text ? new Date() : null,
        postMortemUpdatedBy: text ? actor.userId : null,
      })
      .where(and(eq(incidents.id, id), eq(incidents.workspaceId, actor.workspaceId)));
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'incident.post_mortem_saved',
      resourceType: 'incident',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { length: text.length },
    });
    return this.reader.get(actor.workspaceId, id);
  }

  async setMetadata(
    actor: ActorContext,
    id: string,
    input: IncidentMetadataInput,
  ): Promise<Incident> {
    await this.response.locked(actor, id, undefined, (tx, row) =>
      this.response.write(
        tx,
        actor,
        row,
        { metadata: input.metadata },
        {
          kind: 'updated',
          summary: 'Metadata updated',
          attributes: { before: row.metadata, after: input.metadata },
        },
      ),
    );
    return this.reader.get(actor.workspaceId, id);
  }
}
