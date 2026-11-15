import { HttpStatus } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { MAX_RANGE_DAYS, type QueryMeta } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import type { Database, Tx } from '../../../core/db/client';
import { parseQuery, QuerySyntaxError } from '../domain/query-language';
import { RangeError, resolveRange, type TimeWindow } from '../domain/range';
import { compileQuery, type QuerySchema } from '../infrastructure/compile-query';

export const STATEMENT_TIMEOUT_MS = 10_000;
export const MATCH_CAP = 10_000;

export function compileInput(q: string, schema: QuerySchema): SQL[] {
  try {
    return compileQuery(parseQuery(q), schema);
  } catch (err) {
    if (err instanceof QuerySyntaxError)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_query', err.message, {
        position: err.position,
      });
    throw err;
  }
}

export function windowOf(input: { range?: string; from?: string; to?: string }): TimeWindow {
  try {
    return resolveRange(input, MAX_RANGE_DAYS);
  } catch (err) {
    if (err instanceof RangeError)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_range', err.message);
    throw err;
  }
}

const isTimeout = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '57014' || e?.cause?.code === '57014';
};

export async function bounded<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`set local statement_timeout = ${STATEMENT_TIMEOUT_MS}`));
      return fn(tx);
    });
  } catch (err) {
    if (isTimeout(err))
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'query_timeout',
        'The query took too long. Narrow the time range or add filters.',
      );
    throw err;
  }
}

export function metaOf(
  window: TimeWindow,
  started: number,
  matched: number,
  returned: number,
  truncated: boolean,
): QueryMeta {
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    matched: Math.min(matched, MATCH_CAP),
    matchedCapped: matched > MATCH_CAP,
    returned,
    truncated,
    tookMs: Date.now() - started,
  };
}
