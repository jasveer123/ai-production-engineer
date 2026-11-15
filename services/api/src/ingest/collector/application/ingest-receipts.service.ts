import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { IngestBatchView } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { ingestBatches, type IngestSinkProgress } from '../../../core/db/schema';
import type { Batch } from '../domain/types';

type Row = typeof ingestBatches.$inferSelect;

export interface ReceiptOptions {
  route: string;
  signal: 'logs' | 'traces' | 'metrics' | 'errors';
  idempotencyKey?: string | null;
}

export interface Receipt {
  id: string;
  sinks: IngestSinkProgress;
  alreadyCompleted: boolean;
}

const STALE_MS = 2 * 60 * 1000;

export const toBatchView = (r: Row): IngestBatchView => ({
  id: r.id,
  route: r.route,
  signal: r.signal,
  idempotencyKey: r.idempotencyKey,
  state: r.state as IngestBatchView['state'],
  counts: r.counts,
  sinks: r.sinks,
  rejections: r.rejections,
  error: r.error,
  createdAt: r.createdAt.toISOString(),
  completedAt: r.completedAt?.toISOString() ?? null,
});

@Injectable()
export class IngestReceipts {
  constructor(@Inject(DB) private readonly db: Database) {}

  async begin(workspaceId: string, batch: Batch, opts: ReceiptOptions): Promise<Receipt> {
    const key = opts.idempotencyKey?.slice(0, 200) || null;
    const values = {
      workspaceId,
      route: opts.route,
      signal: opts.signal,
      idempotencyKey: key,
      counts: { received: batch.received, accepted: acceptedOf(batch), rejected: batch.rejected },
      rejections: batch.rejections,
    };
    const [created] = await this.db
      .insert(ingestBatches)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: ingestBatches.id });
    if (created) return { id: created.id, sinks: {}, alreadyCompleted: false };
    return this.resume(workspaceId, key!);
  }

  private async resume(workspaceId: string, key: string): Promise<Receipt> {
    const [row] = await this.db
      .select()
      .from(ingestBatches)
      .where(
        and(eq(ingestBatches.workspaceId, workspaceId), eq(ingestBatches.idempotencyKey, key)),
      );
    if (!row) throw new ApiException(HttpStatus.CONFLICT, 'batch_conflict', 'Retry the request');
    if (row.state === 'completed') return { id: row.id, sinks: row.sinks, alreadyCompleted: true };
    if (row.state === 'processing' && Date.now() - row.updatedAt.getTime() < STALE_MS)
      throw new ApiException(
        HttpStatus.CONFLICT,
        'batch_in_progress',
        'A request with this idempotency key is still being processed',
      );
    await this.db
      .update(ingestBatches)
      .set({ state: 'processing', error: null })
      .where(eq(ingestBatches.id, row.id));
    return { id: row.id, sinks: row.sinks, alreadyCompleted: false };
  }

  async checkpoint(id: string, sinks: IngestSinkProgress): Promise<void> {
    await this.db.update(ingestBatches).set({ sinks }).where(eq(ingestBatches.id, id));
  }

  async finish(id: string, sinks: IngestSinkProgress, error: Error | null): Promise<void> {
    await this.db
      .update(ingestBatches)
      .set(
        error
          ? { state: 'failed', sinks, error: error.message.slice(0, 500) }
          : { state: 'completed', sinks, completedAt: new Date() },
      )
      .where(eq(ingestBatches.id, id));
  }

  async list(workspaceId: string, limit: number): Promise<IngestBatchView[]> {
    const rows = await this.db
      .select()
      .from(ingestBatches)
      .where(eq(ingestBatches.workspaceId, workspaceId))
      .orderBy(desc(ingestBatches.createdAt))
      .limit(limit);
    return rows.map(toBatchView);
  }

  async purge(before: Date): Promise<void> {
    await this.db.delete(ingestBatches).where(lt(ingestBatches.createdAt, before));
  }
}

export const acceptedOf = (b: Batch) =>
  b.logs.length + b.spans.length + b.points.length || b.errors.length;
