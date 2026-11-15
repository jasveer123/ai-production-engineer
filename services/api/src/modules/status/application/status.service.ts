import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import dns from 'node:dns/promises';
import { and, asc, count, eq, isNull, ne } from 'drizzle-orm';
import type {
  CreateStatusPageInput,
  HeaderLayout,
  PageTheme,
  StatusPageView,
  UpdateStatusPageInput,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { statusPageMonitors, statusPages, statusReports } from '../../../core/db/schema';
import { hashPassword } from '../../auth/domain/password';
import { StructureService } from './structure.service';
import { SubscribersService } from './subscribers.service';

export type PageRow = typeof statusPages.$inferSelect;

export const brandingOf = (row: PageRow) => ({
  logoUrl: row.logoUrl,
  logoDarkUrl: row.logoDarkUrl,
  homepageUrl: row.homepageUrl,
  contactUrl: row.contactUrl,
  theme: row.theme as PageTheme,
  headerLayout: row.headerLayout as HeaderLayout,
  hideFromSearch: row.hideFromSearch,
});

const BRANDING_KEYS = [
  'logoUrl',
  'logoDarkUrl',
  'homepageUrl',
  'contactUrl',
  'theme',
  'headerLayout',
  'hideFromSearch',
] as const;

@Injectable()
export class StatusService {
  resolveTxt: (host: string) => Promise<string[][]> = (host) => dns.resolveTxt(host);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly subscribers: SubscribersService,
    private readonly structure: StructureService,
  ) {}

  private async toView(row: PageRow): Promise<StatusPageView> {
    const monitors = await this.db
      .select({ id: statusPageMonitors.monitorId })
      .from(statusPageMonitors)
      .where(eq(statusPageMonitors.pageId, row.id))
      .orderBy(asc(statusPageMonitors.position));
    const [open] = await this.db
      .select({ n: count() })
      .from(statusReports)
      .where(and(eq(statusReports.pageId, row.id), isNull(statusReports.resolvedAt)));
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      monitorIds: monitors.map((m) => m.id),
      customDomain: row.customDomain,
      domainToken: row.customDomain ? row.domainToken : null,
      domainVerified: Boolean(row.domainVerifiedAt),
      cnameTarget: new URL(this.env.WEB_URL).hostname,
      isPrivate: Boolean(row.passwordHash),
      subscribers: await this.subscribers.count(row.id),
      openReports: open?.n ?? 0,
      createdAt: row.createdAt.toISOString(),
      ...brandingOf(row),
    };
  }

  async find(actor: ActorContext, id: string): Promise<PageRow> {
    const [row] = await this.db
      .select()
      .from(statusPages)
      .where(and(eq(statusPages.id, id), eq(statusPages.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Status page');
    return row;
  }

  async list(actor: ActorContext): Promise<StatusPageView[]> {
    const rows = await this.db
      .select()
      .from(statusPages)
      .where(eq(statusPages.workspaceId, actor.workspaceId))
      .orderBy(asc(statusPages.createdAt));
    return Promise.all(rows.map((row) => this.toView(row)));
  }

  async get(actor: ActorContext, id: string): Promise<StatusPageView> {
    return this.toView(await this.find(actor, id));
  }

  private async assertSlugFree(slug: string, exceptId?: string) {
    const [taken] = await this.db
      .select({ id: statusPages.id })
      .from(statusPages)
      .where(and(eq(statusPages.slug, slug), exceptId ? ne(statusPages.id, exceptId) : undefined));
    if (taken) throw new ApiException(409, 'slug_taken', 'That address is already used');
  }

  async create(actor: ActorContext, input: CreateStatusPageInput): Promise<StatusPageView> {
    const slug = input.slug.trim().toLowerCase();
    await this.assertSlugFree(slug);
    const [row] = await this.db
      .insert(statusPages)
      .values({
        workspaceId: actor.workspaceId,
        name: input.name,
        slug,
        description: input.description || null,
      })
      .returning();
    await this.structure.fromMonitors(row!, input.monitorIds ?? []);
    return this.toView(row!);
  }

  private async domainPatch(current: PageRow, domain: string | null | undefined) {
    if (domain === undefined || domain === current.customDomain) return {};
    if (domain) {
      const [taken] = await this.db
        .select({ id: statusPages.id })
        .from(statusPages)
        .where(eq(statusPages.customDomain, domain));
      if (taken) throw new ApiException(409, 'domain_taken', 'That domain is already used');
    }
    return {
      customDomain: domain,
      domainToken: domain ? randomBytes(12).toString('hex') : null,
      domainVerifiedAt: null,
    };
  }

  async update(
    actor: ActorContext,
    id: string,
    input: UpdateStatusPageInput,
  ): Promise<StatusPageView> {
    const current = await this.find(actor, id);
    if (input.slug && input.slug !== current.slug) await this.assertSlugFree(input.slug, id);
    const branding = Object.fromEntries(
      BRANDING_KEYS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]),
    );
    const [row] = await this.db
      .update(statusPages)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.password !== undefined
          ? { passwordHash: input.password ? await hashPassword(input.password) : null }
          : {}),
        ...branding,
        ...(await this.domainPatch(current, input.customDomain)),
      })
      .where(and(eq(statusPages.id, id), eq(statusPages.workspaceId, actor.workspaceId)))
      .returning();
    if (input.monitorIds) await this.structure.fromMonitors(row!, input.monitorIds);
    return this.toView(row!);
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor, id);
    await this.db
      .delete(statusPages)
      .where(and(eq(statusPages.id, id), eq(statusPages.workspaceId, actor.workspaceId)));
  }

  async verifyDomain(actor: ActorContext, id: string): Promise<StatusPageView> {
    const page = await this.find(actor, id);
    if (!page.customDomain || !page.domainToken)
      throw new ApiException(400, 'no_domain', 'Add a custom domain first');
    let records: string[][] = [];
    try {
      records = await this.resolveTxt(`_pramaan.${page.customDomain}`);
    } catch {
      records = [];
    }
    const expected = `pramaan-verify=${page.domainToken}`;
    if (!records.some((r) => r.join('') === expected))
      throw new ApiException(
        422,
        'domain_not_verified',
        `Add a TXT record at _pramaan.${page.customDomain} with the value ${expected}`,
      );
    const [row] = await this.db
      .update(statusPages)
      .set({ domainVerifiedAt: new Date() })
      .where(eq(statusPages.id, id))
      .returning();
    return this.toView(row!);
  }
}
