import { Inject, Injectable, Logger } from '@nestjs/common';
import { lt, sql } from 'drizzle-orm';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { ingestRateWindows } from '../../../core/db/schema';

const PRUNE_EVERY = 500;

export interface LimitResult {
  allowed: boolean;
  retryAfter: number;
}

// Fixed-window counter in PostgreSQL so every API replica shares one limit (no Redis client exists in core).
@Injectable()
export class WindowLimiter {
  private readonly logger = new Logger(WindowLimiter.name);
  private calls = 0;

  constructor(@Inject(DB) private readonly db: Database) {}

  async hit(
    key: string,
    limit: number,
    windowSeconds = 60,
    now = Date.now(),
  ): Promise<LimitResult> {
    const windowMs = windowSeconds * 1000;
    const start = Math.floor(now / windowMs) * windowMs;
    const [row] = await this.db
      .insert(ingestRateWindows)
      .values({ key: key.slice(0, 200), windowStart: new Date(start), hits: 1 })
      .onConflictDoUpdate({
        target: [ingestRateWindows.key, ingestRateWindows.windowStart],
        set: { hits: sql`${ingestRateWindows.hits} + 1` },
      })
      .returning({ hits: ingestRateWindows.hits });
    if (++this.calls % PRUNE_EVERY === 0) void this.prune(new Date(start - windowMs));
    return {
      allowed: (row?.hits ?? 0) <= limit,
      retryAfter: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
    };
  }

  private async prune(before: Date): Promise<void> {
    try {
      await this.db.delete(ingestRateWindows).where(lt(ingestRateWindows.windowStart, before));
    } catch (err) {
      this.logger.warn(`Rate window prune failed: ${(err as Error).message}`);
    }
  }
}
