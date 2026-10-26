import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { GitHubOverview, RepoCommit, RepositoryAccess } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, conflict, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { integrations, services, workspaceMembers } from '../db/schema';
import { GitHubAppClient, GitHubError } from './github-app';
import {
  missingPermissions,
  NEEDED_PERMISSIONS,
  pickRepositories,
  type GitHubConfig,
  type IntegrationRow as Row,
} from './github-config';

/**
 * GitHub App integration (ADR-009). The workspace stores only the installation id; tokens are
 * minted on demand. Revocation (uninstall) is detected by the health check and stops all access.
 *
 * One GitHub installation can be attached to several workspaces the same person belongs to, each
 * with its own repository subset. A workspace you are not a member of cannot claim it.
 */
@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private client?: GitHubAppClient;
  private slug?: string;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly audit: AuditService,
  ) {}

  get configured(): boolean {
    return Boolean(this.env.GITHUB_APP_ID && this.env.GITHUB_APP_PRIVATE_KEY_PATH);
  }

  /** Lazily loads the key so the API still starts (with GitHub disabled) when it is missing. */
  gh(): GitHubAppClient {
    if (!this.configured) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'github_not_configured',
        'Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH for the API',
      );
    }
    if (!this.client) {
      const path = this.env.GITHUB_APP_PRIVATE_KEY_PATH!.replace(/^~(?=\/)/, homedir());
      this.client = new GitHubAppClient(
        this.env.GITHUB_APP_ID!,
        readFileSync(path, 'utf8'),
        this.env.GITHUB_API_URL,
      );
    }
    return this.client;
  }

  /** The App's URL slug, cached; null when GitHub does not answer. */
  async appSlug(): Promise<string | null> {
    this.slug ??= (await this.gh().app()).slug;
    return this.slug;
  }

  /** For tests: swap in a fake client. */
  useClient(client: GitHubAppClient) {
    this.client = client;
  }

  /** Reads an installation and which repositories it grants (404 means it is gone). */
  private async describeInstallation(
    installationId: number,
    requested?: string[],
  ): Promise<GitHubConfig> {
    const gh = this.gh();
    try {
      const inst = await gh.getInstallation(installationId);
      const repos = await gh.listRepositories(installationId);
      const granted = repos.map((r) => r.full_name);
      return {
        installationId,
        accountLogin: inst.account?.login ?? 'unknown',
        accountType: inst.account?.type,
        repositorySelection: inst.repository_selection,
        permissions: inst.permissions,
        grantedRepositories: granted,
        repositories: pickRepositories(granted, requested),
      };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) throw notFound('GitHub installation');
      throw err;
    }
  }

  /** Connects an installation after validating it and reading which repositories it grants. */
  async connect(
    actor: ActorContext,
    installationId: number,
    name: string,
    repositories?: string[],
  ): Promise<Row> {
    const config = await this.describeInstallation(installationId, repositories);
    const claims = await this.db
      .select({ id: integrations.id, workspaceId: integrations.workspaceId })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'github'),
          eq(integrations.externalAccountId, String(installationId)),
          ne(integrations.status, 'disconnected'),
        ),
      );
    const mine = new Set(await this.memberWorkspaceIds(actor.userId));
    if (claims.some((c) => c.workspaceId !== actor.workspaceId && !mine.has(c.workspaceId))) {
      throw conflict('This GitHub installation is already connected to another workspace');
    }
    const existingHere = claims.find((c) => c.workspaceId === actor.workspaceId);
    const values = {
      name,
      status: 'connected' as const,
      lastError: null,
      lastSyncAt: new Date(),
      config: { ...config },
    };
    const [row] = existingHere
      ? await this.db
          .update(integrations)
          .set(values)
          .where(
            and(
              eq(integrations.id, existingHere.id),
              eq(integrations.workspaceId, actor.workspaceId),
            ),
          )
          .returning()
      : await this.db
          .insert(integrations)
          .values({
            ...values,
            workspaceId: actor.workspaceId,
            provider: 'github',
            externalAccountId: String(installationId),
          })
          .returning();
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: existingHere ? 'integration.updated' : 'integration.created',
      resourceType: 'integration',
      resourceId: row!.id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: {
        provider: 'github',
        installationId,
        account: config.accountLogin,
        repositories: config.repositories,
      },
    });
    return row!;
  }

  private async memberWorkspaceIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));
    return rows.map((r) => r.id);
  }

  /**
   * Re-validates one integration. Uninstalled -> disconnected (permanent, access stops);
   * suspended or network failure -> error. Refreshes the repository list on success.
   */
  async check(row: Row): Promise<Row> {
    const cfg = row.config as unknown as GitHubConfig;
    const gh = this.gh();
    let patch: Partial<Row>;
    try {
      const inst = await gh.getInstallation(cfg.installationId);
      if (inst.suspended_at) {
        patch = {
          status: 'error',
          lastError: `The GitHub App was suspended on ${cfg.accountLogin}`,
        };
      } else {
        const repos = await gh.listRepositories(cfg.installationId);
        const granted = repos.map((r) => r.full_name);
        const previous = cfg.repositories ?? granted;
        const selected = previous.filter((name) =>
          granted.some((g) => g.toLowerCase() === name.toLowerCase()),
        );
        patch = {
          status: 'connected',
          lastError: null,
          lastSyncAt: new Date(),
          config: {
            ...cfg,
            grantedRepositories: granted,
            repositories: selected.length ? selected : granted,
            accountType: inst.account?.type,
            repositorySelection: inst.repository_selection,
            permissions: inst.permissions,
          },
        };
      }
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) {
        gh.forget(cfg.installationId);
        patch = {
          status: 'disconnected',
          lastError: `The GitHub App was uninstalled from ${cfg.accountLogin}. Reinstall it and connect again.`,
        };
      } else {
        patch = { status: 'error', lastError: `GitHub check failed: ${(err as Error).message}` };
      }
    }
    // Only the check that actually flips the row to disconnected records the revocation, so two
    // concurrent checks (overlapping timers, a restart) never audit it twice.
    const [updated] = await this.db
      .update(integrations)
      .set(patch)
      .where(and(eq(integrations.id, row.id), ne(integrations.status, 'disconnected')))
      .returning();
    if (!updated) {
      const [current] = await this.db
        .select()
        .from(integrations)
        .where(and(eq(integrations.id, row.id), eq(integrations.workspaceId, row.workspaceId)));
      return current!;
    }
    if (updated.status === 'disconnected') {
      await this.audit.record({
        workspaceId: row.workspaceId,
        actorType: 'system',
        action: 'integration.revoked',
        resourceType: 'integration',
        resourceId: row.id,
        outcome: 'success',
        correlationId: `github-health-${row.id}`,
        metadata: { provider: 'github', installationId: cfg.installationId },
      });
    }
    return updated;
  }

  /** Background health check for every active GitHub integration. */
  async checkAll(): Promise<void> {
    if (!this.configured) return;
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'github'),
          inArray(integrations.status, ['connected', 'error']),
        ),
      );
    for (const row of rows) {
      try {
        await this.check(row);
      } catch (err) {
        this.logger.warn(`GitHub check for ${row.id} failed: ${(err as Error).message}`);
      }
    }
  }

  private async connectedInstallations(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, workspaceId),
          eq(integrations.provider, 'github'),
          eq(integrations.status, 'connected'),
        ),
      );
    return rows.map((r) => ({ id: r.id, cfg: r.config as unknown as GitHubConfig }));
  }

  /**
   * The workspace's installations, refreshed from GitHub (at most every 20 s), with what each
   * automation still needs and where to fix it.
   */
  async overview(actor: ActorContext): Promise<GitHubOverview> {
    const empty: GitHubOverview = {
      configured: this.configured,
      installations: [],
      missing: { setupPullRequest: [], deployWorkflow: [] },
      appPermissionsUrl: null,
      unreachableServiceRepos: [],
    };
    if (!this.configured) return empty;
    const rows = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'github'),
          inArray(integrations.status, ['connected', 'error']),
        ),
      );
    const fresh = await Promise.all(
      rows.map(async (r) =>
        r.lastSyncAt &&
        Date.now() - r.lastSyncAt.getTime() < 20_000 &&
        (r.config as unknown as GitHubConfig).permissions
          ? r
          : this.check(r).catch(() => r),
      ),
    );
    const installations = fresh
      .filter((r) => r.status !== 'disconnected')
      .map((r) => {
        const cfg = r.config as unknown as GitHubConfig;
        const org = cfg.accountType === 'Organization';
        return {
          integrationId: r.id,
          installationId: cfg.installationId,
          account: cfg.accountLogin,
          status: r.status,
          lastError: r.lastError,
          repositorySelection: cfg.repositorySelection ?? null,
          repositories: cfg.repositories ?? [],
          permissions: cfg.permissions ?? {},
          manageUrl: org
            ? `https://github.com/organizations/${cfg.accountLogin}/settings/installations/${cfg.installationId}`
            : `https://github.com/settings/installations/${cfg.installationId}`,
        };
      });
    const perms = installations[0]?.permissions;
    const mapped = await this.db
      .selectDistinct({ repo: services.repositoryFullName })
      .from(services)
      .where(eq(services.workspaceId, actor.workspaceId));
    const reachable = new Set(
      installations.flatMap((i) => i.repositories.map((x) => x.toLowerCase())),
    );
    const slug = await this.appSlug().catch(() => null); // works without the app's slug
    return {
      configured: true,
      installations,
      missing: installations.length
        ? {
            setupPullRequest: missingPermissions(perms, NEEDED_PERMISSIONS.setupPullRequest),
            deployWorkflow: missingPermissions(perms, NEEDED_PERMISSIONS.deployWorkflow),
          }
        : empty.missing,
      appPermissionsUrl: slug ? `https://github.com/settings/apps/${slug}/permissions` : null,
      unreachableServiceRepos: mapped
        .map((m) => m.repo)
        .filter((r): r is string => !!r && !reachable.has(r.toLowerCase())),
    };
  }

  /** Which mapped repositories this workspace can actually read (FR-03: never guess). */
  async repositoryAccess(actor: ActorContext): Promise<RepositoryAccess[]> {
    const installs = await this.connectedInstallations(actor.workspaceId);
    const repos = await this.db
      .selectDistinct({ repo: services.repositoryFullName })
      .from(services)
      .where(eq(services.workspaceId, actor.workspaceId));
    return repos
      .filter((r): r is { repo: string } => !!r.repo)
      .map(({ repo }) => {
        const match = installs.find((i) =>
          i.cfg.repositories.some((r) => r.toLowerCase() === repo.toLowerCase()),
        );
        return { repositoryFullName: repo, accessible: !!match, integrationId: match?.id ?? null };
      });
  }

  /** Recent commits of a mapped service's repository, read with a short-lived installation token. */
  async recentCommits(actor: ActorContext, serviceId: string, limit = 5): Promise<RepoCommit[]> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.workspaceId, actor.workspaceId)));
    if (!service) throw notFound('Service');
    if (!service.repositoryFullName) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'repository_not_mapped',
        'Map this service to a repository first',
      );
    }
    const repo = service.repositoryFullName;
    const install = (await this.connectedInstallations(actor.workspaceId)).find((i) =>
      i.cfg.repositories.some((r) => r.toLowerCase() === repo.toLowerCase()),
    );
    if (!install) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'repository_not_accessible',
        `No connected GitHub installation can read ${repo}`,
      );
    }
    const commits = await this.gh().listCommits(install.cfg.installationId, repo, {
      sha: service.defaultBranch,
      limit,
    });
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0] ?? '',
      author: c.commit.author?.name ?? null,
      date: c.commit.author?.date ?? null,
      url: c.html_url,
    }));
  }

  /** Installation that can read `repo` in this workspace, if any. */
  async installationFor(workspaceId: string, repo: string): Promise<number | null> {
    const match = (await this.connectedInstallations(workspaceId)).find((i) =>
      i.cfg.repositories.some((r) => r.toLowerCase() === repo.toLowerCase()),
    );
    return match?.cfg.installationId ?? null;
  }
}
