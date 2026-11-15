import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, inArray, lt, lte, notInArray } from 'drizzle-orm';
import { CLOSED_STATUSES, type DeliveryChannel, type DeliveryState } from '@ape/api-contracts';
import { DB } from '../../../core/db/database.module';
import type { Database, Tx } from '../../../core/db/client';
import { deliveryAttempts, incidents, notificationChannels } from '../../../core/db/schema';
import {
  afterSend,
  callbackState,
  DUE_STATES,
  EXPIRED_LEASE_ERROR,
  IDEMPOTENT_CHANNELS,
  LEASE_MS,
  type Transition,
} from '../domain/delivery-state';
import type { Notification } from '../domain/messages';
import {
  NotificationSender,
  type Destination,
} from '../infrastructure/notification-sender.service';

export type AttemptRow = typeof deliveryAttempts.$inferSelect;

export interface NewAttempt {
  workspaceId: string;
  incidentId: string | null;
  runId?: string | null;
  stepIndex?: number | null;
  channelId?: string | null;
  userId?: string | null;
  dedupKey: string;
  eventType: string;
  channel: DeliveryChannel;
  address: string;
  recipientName?: string | null;
  payload: Notification;
  /** Set when the attempt cannot be sent at all (no phone on file); recorded, never sent. */
  problem?: string;
}

const BATCH = 50;

@Injectable()
export class DeliveryLedger {
  private readonly logger = new Logger(DeliveryLedger.name);
  private readonly owner = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sender: NotificationSender,
  ) {}

  async enqueue(db: Database | Tx, rows: NewAttempt[]): Promise<string[]> {
    if (rows.length === 0) return [];
    const inserted = await db
      .insert(deliveryAttempts)
      .values(
        rows.map(({ payload, problem, ...r }) => ({
          ...r,
          payload: payload as unknown as Record<string, unknown>,
          ...(problem
            ? { state: 'failed_permanent', error: problem, nextAttemptAt: null }
            : { state: 'queued' }),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: deliveryAttempts.id, state: deliveryAttempts.state });
    return inserted.filter((r) => r.state === 'queued').map((r) => r.id);
  }

  /** Sends freshly committed intents right away; the due loop retries whatever this misses. */
  async deliverNow(ids: string[], now = new Date()): Promise<AttemptRow[]> {
    if (ids.length === 0) return [];
    const leased = await this.lease(now, ids);
    return Promise.all(leased.map((row) => this.process(row, now)));
  }

  async processDue(now = new Date()): Promise<number> {
    await this.recoverExpiredLeases(now);
    const leased = await this.lease(now);
    for (const row of leased) await this.process(row, now);
    return leased.length;
  }

  private async recoverExpiredLeases(now: Date): Promise<void> {
    const expired = and(
      eq(deliveryAttempts.state, 'leased'),
      lt(deliveryAttempts.leaseExpiresAt, now),
    );
    const release = { leaseOwner: null, leaseExpiresAt: null };
    await this.db
      .update(deliveryAttempts)
      .set({ ...release, state: 'retry_wait', nextAttemptAt: now })
      .where(and(expired, inArray(deliveryAttempts.channel, [...IDEMPOTENT_CHANNELS])));
    await this.db
      .update(deliveryAttempts)
      .set({
        ...release,
        state: 'outcome_unknown',
        nextAttemptAt: null,
        error: EXPIRED_LEASE_ERROR,
      })
      .where(and(expired, notInArray(deliveryAttempts.channel, [...IDEMPOTENT_CHANNELS])));
  }

  private lease(now: Date, ids?: string[]): Promise<AttemptRow[]> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({ id: deliveryAttempts.id })
        .from(deliveryAttempts)
        .where(
          ids
            ? and(inArray(deliveryAttempts.id, ids), eq(deliveryAttempts.state, 'queued'))
            : and(
                inArray(deliveryAttempts.state, [...DUE_STATES]),
                lte(deliveryAttempts.nextAttemptAt, now),
              ),
        )
        .orderBy(asc(deliveryAttempts.nextAttemptAt))
        .limit(ids?.length ?? BATCH)
        .for('update', { skipLocked: true });
      if (due.length === 0) return [];
      return tx
        .update(deliveryAttempts)
        .set({
          state: 'leased',
          leaseOwner: this.owner,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        })
        .where(
          inArray(
            deliveryAttempts.id,
            due.map((d) => d.id),
          ),
        )
        .returning();
    });
  }

  private async fenced(row: AttemptRow): Promise<string | null> {
    if (!row.runId || !row.incidentId) return null;
    const [incident] = await this.db
      .select({ acknowledgedAt: incidents.acknowledgedAt, status: incidents.status })
      .from(incidents)
      .where(and(eq(incidents.id, row.incidentId), eq(incidents.workspaceId, row.workspaceId)));
    if (!incident) return 'The incident was deleted before sending';
    if (incident.acknowledgedAt) return 'The incident was acknowledged before sending';
    if ((CLOSED_STATUSES as readonly string[]).includes(incident.status))
      return 'The incident was closed before sending';
    return null;
  }

  private async destination(row: AttemptRow): Promise<Destination | string> {
    const dest: Destination = {
      attemptId: row.id,
      channel: row.channel as DeliveryChannel,
      address: row.address,
      workspaceId: row.workspaceId,
      secretReference: null,
    };
    if (!row.channelId) return dest;
    const [channel] = await this.db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.id, row.channelId),
          eq(notificationChannels.workspaceId, row.workspaceId),
        ),
      );
    if (!channel) return 'The channel was deleted before sending';
    return { ...dest, address: channel.url ?? '', secretReference: channel.secretReference };
  }

  private async process(row: AttemptRow, now: Date): Promise<AttemptRow> {
    const fence = await this.fenced(row);
    const dest = fence ?? (await this.destination(row));
    if (typeof dest === 'string')
      return this.record(
        row,
        {
          state: 'cancelled',
          nextAttemptAt: null,
          providerMessageId: null,
          responseStatus: null,
          error: dest,
          sentAt: null,
          deliveredAt: null,
        },
        false,
      );
    let transition: Transition;
    try {
      const outcome = await this.sender.send(dest, row.payload as unknown as Notification);
      transition = afterSend(outcome, {
        attempts: row.attempts + 1,
        maxAttempts: row.maxAttempts,
        channel: row.channel,
        now: new Date(),
      });
    } catch (err) {
      transition = afterSend(
        { kind: 'transient', error: (err as Error).message, status: null, retryAfterMs: null },
        { attempts: row.attempts + 1, maxAttempts: row.maxAttempts, channel: row.channel, now },
      );
    }
    return this.record(row, transition, true);
  }

  private async record(row: AttemptRow, t: Transition, tried: boolean): Promise<AttemptRow> {
    const [updated] = await this.db
      .update(deliveryAttempts)
      .set({
        ...t,
        attempts: tried ? row.attempts + 1 : row.attempts,
        leaseOwner: null,
        leaseExpiresAt: null,
      })
      .where(and(eq(deliveryAttempts.id, row.id), eq(deliveryAttempts.leaseOwner, this.owner)))
      .returning();
    if (row.channelId && tried) {
      const ok = t.state === 'delivered' || t.state === 'provider_accepted';
      await this.db
        .update(notificationChannels)
        .set(ok ? { lastDeliveryAt: new Date(), lastError: null } : { lastError: t.error })
        .where(eq(notificationChannels.id, row.channelId));
    }
    if (t.error) this.logger.warn(`Delivery ${row.id} (${row.channel}) → ${t.state}: ${t.error}`);
    return updated ?? row;
  }

  async applyProviderStatus(
    providerMessageId: string,
    status: string,
    error?: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: deliveryAttempts.id, state: deliveryAttempts.state })
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.providerMessageId, providerMessageId));
    if (!row) return false;
    const next: DeliveryState | null = callbackState(row.state, status);
    if (!next) return true;
    await this.db
      .update(deliveryAttempts)
      .set({
        state: next,
        ...(next === 'delivered' ? { deliveredAt: new Date() } : {}),
        ...(next === 'failed_permanent' ? { error: error ?? `Provider reported ${status}` } : {}),
      })
      .where(and(eq(deliveryAttempts.id, row.id), eq(deliveryAttempts.state, row.state)));
    return true;
  }
}
