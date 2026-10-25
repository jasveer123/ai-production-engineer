import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/errors';

/**
 * Fixed-window counter per key, in memory. Good enough for one API process; behind several
 * replicas the account lockout in the database is still the real brute-force protection.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Throws 429 once `key` has used up its window. */
  check(key: string, now = Date.now()): void {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.sweep(now);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limited',
        'Too many attempts. Wait a minute and try again.',
        { retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) },
      );
    }
  }

  private sweep(now: number): void {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
