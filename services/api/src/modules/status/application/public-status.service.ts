import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import {
  HISTORY_DAYS,
  type PublicHistory,
  type PublicResource,
  type PublicStatus,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import {
  monitorChecks,
  statusMaintenances,
  statusPages,
  statusReports,
  statusUpdates,
} from '../../../core/db/schema';
import { verifyPassword } from '../../auth/domain/password';
import { overallStatus } from '../domain/projection';
import { renderAtom, renderRss } from '../domain/feed';
import { brandingOf, type PageRow } from './status.service';
import { loadMaintenances, loadReports, loadStructure, type LoadedResource } from './status-read';
import { StructureService } from './structure.service';

const DAY = 24 * 3600 * 1000;
const ACCESS_TTL_MS = 12 * 3600 * 1000;
const pct = (ok: number, total: number) => Math.round((ok / total) * 10_000) / 100;

export interface PageLookup {
  slug?: string;
  host?: string;
}

@Injectable()
export class PublicStatusService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly structure: StructureService,
  ) {}

  async page(lookup: PageLookup, access: string | undefined, now = new Date()): Promise<PageRow> {
    const where = lookup.host
      ? and(
          eq(statusPages.customDomain, lookup.host.toLowerCase()),
          isNotNull(statusPages.domainVerifiedAt),
        )
      : eq(statusPages.slug, (lookup.slug ?? '').toLowerCase());
    const [page] = await this.db.select().from(statusPages).where(where);
    if (!page) throw notFound('Status page');
    if (page.passwordHash && !this.validAccess(page, access, now))
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'password_required',
        'This status page is private',
        {
          name: page.name,
          slug: page.slug,
        },
      );
    return page;
  }

  async grantAccess(slug: string, password: string, now = new Date()): Promise<{ token: string }> {
    const [page] = await this.db
      .select()
      .from(statusPages)
      .where(eq(statusPages.slug, slug.toLowerCase()));
    if (!page) throw notFound('Status page');
    if (!page.passwordHash || !(await verifyPassword(password, page.passwordHash)))
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'wrong_password',
        'That password is not right',
      );
    const expires = now.getTime() + ACCESS_TTL_MS;
    return { token: `${expires}.${this.sign(page, expires)}` };
  }

  private sign(page: PageRow, expires: number) {
    return createHmac('sha256', this.env.JWT_SECRET)
      .update(`${page.id}:${page.passwordHash}:${expires}`)
      .digest('hex');
  }

  private validAccess(page: PageRow, token: string | undefined, now: Date): boolean {
    const [expires, signature] = (token ?? '').split('.');
    if (!expires || !signature || Number(expires) < now.getTime()) return false;
    const expected = Buffer.from(this.sign(page, Number(expires)));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async view(page: PageRow, now = new Date()): Promise<PublicStatus> {
    await this.structure.adoptLegacyLinks(page);
    const loaded = await loadStructure(this.db, page.id, now);
    const history = await this.history(loaded.resources, now);
    const toPublic = (r: LoadedResource): PublicResource => ({
      id: r.id,
      name: r.publicName,
      explanation: r.explanation,
      state: r.state,
      showHistory: r.showHistory,
      ...(history.get(r.id) ?? { uptime: null, days: [] }),
    });
    const recent = new Date(now.getTime() - DAY);
    return {
      slug: page.slug,
      name: page.name,
      description: page.description,
      ...brandingOf(page),
      overall: overallStatus(loaded.resources.map((r) => r.state)),
      sections: loaded.sections
        .map((s) => ({
          id: s.id,
          name: s.name,
          resources: loaded.resources.filter((r) => r.sectionId === s.id).map(toPublic),
        }))
        .filter((s) => s.resources.length > 0),
      reports: await loadReports(
        this.db,
        page.id,
        and(
          lte(statusReports.publishedAt, now),
          or(isNull(statusReports.resolvedAt), gt(statusReports.resolvedAt, recent)),
        ),
        20,
      ),
      maintenances: await loadMaintenances(
        this.db,
        page.id,
        gt(statusMaintenances.endsAt, now),
        now,
      ),
      generatedAt: now.toISOString(),
    };
  }

  private async history(resources: LoadedResource[], now: Date) {
    const since = new Date(now.getTime() - (HISTORY_DAYS - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    const ids = [...new Set(resources.flatMap((r) => r.monitorIds))];
    const buckets = ids.length
      ? await this.db
          .select({
            monitorId: monitorChecks.monitorId,
            day: sql<string>`to_char(date_trunc('day', ${monitorChecks.checkedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
            total: sql<number>`count(*)::int`,
            ok: sql<number>`(count(*) filter (where ${monitorChecks.ok}))::int`,
          })
          .from(monitorChecks)
          .where(and(inArray(monitorChecks.monitorId, ids), gte(monitorChecks.checkedAt, since)))
          .groupBy(monitorChecks.monitorId, sql`2`)
      : [];
    const dates = Array.from({ length: HISTORY_DAYS }, (_, i) =>
      new Date(since.getTime() + i * DAY).toISOString().slice(0, 10),
    );
    const result = new Map<string, Pick<PublicResource, 'uptime' | 'days'>>();
    for (const r of resources) {
      if (!r.showHistory || r.monitorIds.length === 0) {
        result.set(r.id, { uptime: null, days: [] });
        continue;
      }
      const mine = buckets.filter((b) => r.monitorIds.includes(b.monitorId));
      const total = mine.reduce((n, b) => n + b.total, 0);
      const ok = mine.reduce((n, b) => n + b.ok, 0);
      result.set(r.id, {
        uptime: total ? pct(ok, total) : null,
        days: dates.map((date) => {
          const day = mine.filter((b) => b.day === date);
          const t = day.reduce((n, b) => n + b.total, 0);
          return {
            date,
            uptime: t
              ? pct(
                  day.reduce((n, b) => n + b.ok, 0),
                  t,
                )
              : null,
          };
        }),
      });
    }
    return result;
  }

  async monthHistory(page: PageRow, month: string, now = new Date()): Promise<PublicHistory> {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const until = end < now ? end : now;
    return {
      slug: page.slug,
      name: page.name,
      month,
      reports: await loadReports(
        this.db,
        page.id,
        and(gte(statusReports.publishedAt, start), lt(statusReports.publishedAt, until)),
        200,
      ),
      maintenances: await loadMaintenances(
        this.db,
        page.id,
        and(gte(statusMaintenances.startsAt, start), lt(statusMaintenances.startsAt, end)),
        now,
      ),
    };
  }

  async feed(page: PageRow, format: 'atom' | 'rss', now = new Date()): Promise<string> {
    const rows = await this.db
      .select({
        id: statusUpdates.id,
        title: statusReports.title,
        body: statusUpdates.body,
        state: statusUpdates.state,
        createdAt: statusUpdates.createdAt,
      })
      .from(statusUpdates)
      .innerJoin(statusReports, eq(statusReports.id, statusUpdates.reportId))
      .where(and(eq(statusUpdates.pageId, page.id), lte(statusReports.publishedAt, now)))
      .orderBy(sql`${statusUpdates.createdAt} desc`)
      .limit(30);
    const feed = {
      title: `${page.name} status`,
      link: `${this.env.WEB_URL}/status/${page.slug}`,
      entries: rows.map((r) => ({
        id: r.id,
        title: `${r.state}: ${r.title}`,
        body: r.body,
        updatedAt: r.createdAt,
      })),
    };
    return format === 'atom' ? renderAtom(feed, now) : renderRss(feed);
  }

  async summary(page: PageRow, now = new Date()) {
    const view = await this.view(page, now);
    return {
      page: { name: view.name, url: `${this.env.WEB_URL}/status/${view.slug}` },
      status: view.overall,
      resources: view.sections.flatMap((s) =>
        s.resources.map((r) => ({
          id: r.id,
          name: r.name,
          section: s.name,
          state: r.state,
          uptime: r.uptime,
        })),
      ),
      activeReports: view.reports
        .filter((r) => !r.resolvedAt)
        .map((r) => ({ id: r.id, title: r.title, state: r.state, publishedAt: r.publishedAt })),
      maintenances: view.maintenances.map((m) => ({
        id: m.id,
        title: m.title,
        phase: m.phase,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
      })),
      generatedAt: view.generatedAt,
    };
  }
}
