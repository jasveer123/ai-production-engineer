import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type {
  DeliveryAttemptView,
  DeliveryChannel,
  DeliveryQuery,
  DeliveryState,
} from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { deliveryAttempts, notificationChannels } from '../../../core/db/schema';
import { maskPhone, maskTarget } from '../domain/messages';
import type { AttemptRow } from './delivery-ledger.service';

function displayAddress(row: AttemptRow): string {
  if (row.channelId || row.channel === 'email') return row.address;
  if (row.channel === 'sms' || row.channel === 'call') return maskPhone(row.address);
  return maskTarget('webhook', row.address);
}

export function attemptView(
  row: AttemptRow,
  channelName: string | null = null,
): DeliveryAttemptView {
  return {
    id: row.id,
    incidentId: row.incidentId,
    runId: row.runId,
    stepIndex: row.stepIndex,
    eventType: row.eventType,
    channel: row.channel as DeliveryChannel,
    channelName,
    recipientName: row.recipientName,
    address: displayAddress(row),
    state: row.state as DeliveryState,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    providerMessageId: row.providerMessageId,
    responseStatus: row.responseStatus,
    error: row.error,
    nextAttemptAt: row.state === 'retry_wait' ? (row.nextAttemptAt?.toISOString() ?? null) : null,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  };
}

@Injectable()
export class DeliveryLog {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async query(where: SQL | undefined, limit: number): Promise<DeliveryAttemptView[]> {
    const rows = await this.db
      .select({ a: deliveryAttempts, channelName: notificationChannels.name })
      .from(deliveryAttempts)
      .leftJoin(notificationChannels, eq(notificationChannels.id, deliveryAttempts.channelId))
      .where(where)
      .orderBy(desc(deliveryAttempts.createdAt))
      .limit(limit);
    return rows.map((r) => attemptView(r.a, r.channelName));
  }

  list(workspaceId: string, q: DeliveryQuery): Promise<DeliveryAttemptView[]> {
    return this.query(
      and(
        eq(deliveryAttempts.workspaceId, workspaceId),
        q.state ? eq(deliveryAttempts.state, q.state) : undefined,
        q.channel ? eq(deliveryAttempts.channel, q.channel) : undefined,
      ),
      q.limit,
    );
  }

  forIncident(workspaceId: string, incidentId: string): Promise<DeliveryAttemptView[]> {
    return this.query(
      and(
        eq(deliveryAttempts.workspaceId, workspaceId),
        eq(deliveryAttempts.incidentId, incidentId),
      ),
      200,
    );
  }

  forRuns(workspaceId: string, runIds: string[]): Promise<DeliveryAttemptView[]> {
    if (runIds.length === 0) return Promise.resolve([]);
    return this.query(
      and(eq(deliveryAttempts.workspaceId, workspaceId), inArray(deliveryAttempts.runId, runIds)),
      500,
    );
  }
}
