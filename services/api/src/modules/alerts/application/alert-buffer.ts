import { sql } from 'drizzle-orm';
import type { Database, Tx } from '../../../core/db/client';
import { inboundEvents } from '../../../core/db/schema';
import { ALERT_SOURCE_PREFIX } from './alert-processor';

export interface BufferTarget {
  id: string;
  workspaceId: string;
  kind: string;
}

export interface BufferInput {
  externalEventId: string;
  payload: Record<string, unknown>;
  rejectedReason?: string;
}

export interface BufferResult {
  receiptId: string | null;
  duplicate: boolean;
}

export async function bufferAlertEvent(
  db: Database | Tx,
  target: BufferTarget,
  input: BufferInput,
): Promise<BufferResult> {
  const [row] = await db
    .insert(inboundEvents)
    .values({
      workspaceId: target.workspaceId,
      integrationId: target.id,
      source: `${ALERT_SOURCE_PREFIX}${target.kind}`,
      externalEventId: input.externalEventId.slice(0, 300),
      payload: input.payload,
      ...(input.rejectedReason
        ? {
            status: 'dead' as const,
            deadReason: 'invalid_payload',
            lastError: input.rejectedReason,
          }
        : {}),
    })
    .onConflictDoUpdate({
      target: [inboundEvents.integrationId, inboundEvents.externalEventId],
      set: { duplicateCount: sql`${inboundEvents.duplicateCount} + 1` },
    })
    .returning({ id: inboundEvents.id, existed: sql<boolean>`xmax <> 0` });
  return { receiptId: row?.id ?? null, duplicate: Boolean(row?.existed) };
}
