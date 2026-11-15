import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { AlertReceiptView } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { inboundEvents } from '../../../core/db/schema';
import { AlertSourcesService } from './alert-sources.service';

@Injectable()
export class AlertReceiptsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sources: AlertSourcesService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: ActorContext, id: string, limit = 100): Promise<AlertReceiptView[]> {
    await this.sources.find(actor, id);
    const rows = await this.db
      .select()
      .from(inboundEvents)
      .where(
        and(eq(inboundEvents.workspaceId, actor.workspaceId), eq(inboundEvents.integrationId, id)),
      )
      .orderBy(desc(inboundEvents.receivedAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      externalEventId: r.externalEventId,
      outcome: r.status === 'dead' ? 'rejected' : r.status,
      reason: r.status === 'dead' ? (r.lastError ?? r.deadReason) : r.lastError,
      attempts: r.attempts,
      duplicates: r.duplicateCount,
      receivedAt: r.receivedAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      payload: r.payload,
    }));
  }

  async replay(actor: ActorContext, id: string, receiptId: string): Promise<AlertReceiptView> {
    await this.sources.find(actor, id);
    const [row] = await this.db
      .update(inboundEvents)
      .set({
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
        deadReason: null,
        lastError: null,
        processedAt: null,
      })
      .where(
        and(
          eq(inboundEvents.id, receiptId),
          eq(inboundEvents.integrationId, id),
          eq(inboundEvents.workspaceId, actor.workspaceId),
        ),
      )
      .returning({ id: inboundEvents.id });
    if (!row) throw notFound('Received event');
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'alert_source.event_replayed',
      resourceType: 'alert_source',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { receiptId },
    });
    const [view] = (await this.list(actor, id, 200)).filter((r) => r.id === receiptId);
    return view!;
  }
}
