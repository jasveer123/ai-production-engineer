import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { ErrorEventDetail, ErrorGroupDetail } from '@ape/api-contracts';
import type { Database } from '../../../core/db/client';
import { errorOccurrences, rumSessions } from '../../../core/db/schema';

const FACET_KEYS = 10;
const FACET_VALUES = 5;

export async function usersAffected(
  db: Database,
  groupIds: string[],
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await db
    .select({
      groupId: errorOccurrences.groupId,
      n: sql<number>`count(distinct ${errorOccurrences.userKey})::int`,
    })
    .from(errorOccurrences)
    .where(inArray(errorOccurrences.groupId, groupIds))
    .groupBy(errorOccurrences.groupId);
  return new Map(rows.map((r) => [r.groupId, r.n]));
}

export async function breakdowns(
  db: Database,
  groupId: string,
): Promise<Pick<ErrorGroupDetail, 'byRelease' | 'byEnvironment' | 'tagFacets'>> {
  const [releases, environments, tags] = await Promise.all([
    db
      .select({ release: errorOccurrences.release, count: sql<number>`count(*)::int` })
      .from(errorOccurrences)
      .where(and(eq(errorOccurrences.groupId, groupId), isNotNull(errorOccurrences.release)))
      .groupBy(errorOccurrences.release)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    db
      .select({ environment: errorOccurrences.environment, count: sql<number>`count(*)::int` })
      .from(errorOccurrences)
      .where(and(eq(errorOccurrences.groupId, groupId), isNotNull(errorOccurrences.environment)))
      .groupBy(errorOccurrences.environment)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    db.execute<{ key: string; value: string; count: number }>(sql`
      select t.key, t.value, count(*)::int as count
      from ${errorOccurrences}, jsonb_each_text(${errorOccurrences.tags}) as t(key, value)
      where ${errorOccurrences.groupId} = ${groupId}
      group by t.key, t.value
      order by count(*) desc
      limit 200`),
  ]);
  const facets = new Map<string, { value: string; count: number }[]>();
  for (const row of tags.rows) {
    const values = facets.get(row.key) ?? [];
    if (values.length < FACET_VALUES) values.push({ value: row.value, count: Number(row.count) });
    facets.set(row.key, values);
  }
  return {
    byRelease: releases.map((r) => ({ release: r.release!, count: r.count })),
    byEnvironment: environments.map((r) => ({ environment: r.environment!, count: r.count })),
    tagFacets: [...facets.entries()].slice(0, FACET_KEYS).map(([key, values]) => ({ key, values })),
  };
}

export async function latestEvent(
  db: Database,
  groupId: string,
): Promise<{ event: ErrorEventDetail; release: string | null } | null> {
  const [row] = await db
    .select()
    .from(errorOccurrences)
    .where(and(eq(errorOccurrences.groupId, groupId), isNotNull(errorOccurrences.detail)))
    .orderBy(desc(errorOccurrences.occurredAt))
    .limit(1);
  if (!row?.detail) return null;
  const d = row.detail as Partial<ErrorEventDetail>;
  return {
    release: row.release,
    event: {
      eventId: d.eventId ?? null,
      occurredAt: row.occurredAt.toISOString(),
      level: d.level ?? null,
      platform: d.platform ?? null,
      exceptions: d.exceptions ?? [],
      breadcrumbs: d.breadcrumbs ?? [],
      user: d.user ?? null,
      tags: row.tags,
      contexts: d.contexts ?? {},
      request: d.request ?? null,
    },
  };
}

export async function replaySession(
  db: Database,
  workspaceId: string,
  groupId: string,
): Promise<string | null> {
  const [occ] = await db
    .select({ key: errorOccurrences.rumSessionKey })
    .from(errorOccurrences)
    .where(and(eq(errorOccurrences.groupId, groupId), isNotNull(errorOccurrences.rumSessionKey)))
    .orderBy(desc(errorOccurrences.occurredAt))
    .limit(1);
  if (!occ?.key) return null;
  const [session] = await db
    .select({ id: rumSessions.id })
    .from(rumSessions)
    .where(and(eq(rumSessions.workspaceId, workspaceId), eq(rumSessions.sessionKey, occ.key)))
    .limit(1);
  return session?.id ?? null;
}
