import { and, eq, gte, sql } from 'drizzle-orm';
import type { RumVitalsReport } from '@ape/api-contracts';
import type { Database } from '../../../core/db/client';
import { rumEvents } from '../../../core/db/schema';
import { VITAL_THRESHOLDS } from '../domain/privacy';

const PAGES = 20;

export async function vitalsReport(
  db: Database,
  workspaceId: string,
  q: { appId?: string; minutes: number },
): Promise<RumVitalsReport> {
  const where = and(
    eq(rumEvents.workspaceId, workspaceId),
    eq(rumEvents.type, 'vital'),
    gte(rumEvents.ts, new Date(Date.now() - q.minutes * 60_000)),
    q.appId ? eq(rumEvents.appId, q.appId) : undefined,
  );
  const good = (name: string) => VITAL_THRESHOLDS[name]!.good;
  const poor = (name: string) => VITAL_THRESHOLDS[name]!.poor;
  const ratingCase = (bound: 'good' | 'poor') =>
    sql.join(
      Object.keys(VITAL_THRESHOLDS).map(
        (n) =>
          sql`when ${rumEvents.name} = ${n} then ${bound === 'good' ? good(n) : poor(n)}::float8`,
      ),
      sql` `,
    );
  const path = sql<string>`regexp_replace(regexp_replace(coalesce(${rumEvents.url}, ''), '^[a-z]+://[^/]+', ''), '[?#].*$', '')`;
  const [totals, pages] = await Promise.all([
    db
      .select({
        name: rumEvents.name,
        p75: sql<number | null>`percentile_cont(0.75) within group (order by ${rumEvents.value})`,
        samples: sql<number>`count(*)::int`,
        good: sql<number>`(count(*) filter (where ${rumEvents.value} <= case ${ratingCase('good')} end))::int`,
        poor: sql<number>`(count(*) filter (where ${rumEvents.value} > case ${ratingCase('poor')} end))::int`,
      })
      .from(rumEvents)
      .where(where)
      .groupBy(rumEvents.name),
    db
      .select({
        path,
        name: rumEvents.name,
        p75: sql<number | null>`percentile_cont(0.75) within group (order by ${rumEvents.value})`,
        samples: sql<number>`count(*)::int`,
      })
      .from(rumEvents)
      .where(where)
      .groupBy(sql`1`, rumEvents.name),
  ]);
  const byPage = new Map<string, { samples: number; p75: Record<string, number | null> }>();
  for (const row of pages) {
    const page = byPage.get(row.path || '/') ?? { samples: 0, p75: {} };
    page.samples += row.samples;
    page.p75[row.name] = row.p75 === null ? null : Number(row.p75);
    byPage.set(row.path || '/', page);
  }
  return {
    vitals: totals
      .filter((t) => VITAL_THRESHOLDS[t.name])
      .map((t) => ({
        name: t.name,
        p75: t.p75 === null ? null : Number(t.p75),
        samples: t.samples,
        good: t.good,
        poor: t.poor,
        needsImprovement: t.samples - t.good - t.poor,
      })),
    pages: [...byPage.entries()]
      .sort((a, b) => b[1].samples - a[1].samples)
      .slice(0, PAGES)
      .map(([p, v]) => ({ path: p, ...v })),
  };
}
