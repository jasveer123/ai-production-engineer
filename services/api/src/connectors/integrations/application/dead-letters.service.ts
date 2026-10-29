import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { DeadLetter } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { inboundEvents } from '../../../core/db/schema';
import { IngestionProcessor } from '../../../ingest/ingestion/application/ingestion.processor';

@Injectable()
export class DeadLettersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly processor: IngestionProcessor,
  ) {}

  async deadLetters(actor: ActorContext): Promise<DeadLetter[]> {
    const rows = await this.db
      .select()
      .from(inboundEvents)
      .where(
        and(eq(inboundEvents.workspaceId, actor.workspaceId), eq(inboundEvents.status, 'dead')),
      )
      .orderBy(desc(inboundEvents.receivedAt))
      .limit(100);
    return rows.map((r) => ({
      id: r.id,
      integrationId: r.integrationId,
      source: r.source,
      externalEventId: r.externalEventId,
      attempts: r.attempts,
      deadReason: r.deadReason,
      lastError: r.lastError,
      receivedAt: r.receivedAt.toISOString(),
    }));
  }

  async replayDeadLetter(actor: ActorContext, id: string): Promise<void> {
    const n = await this.processor.replay(actor.workspaceId, [id]);
    if (n === 0) throw notFound('Dead-lettered event');
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'ingest.replayed',
      resourceType: 'inbound_event',
      resourceId: id,
      outcome: 'success',
      correlationId: actor.correlationId,
    });
  }
}
