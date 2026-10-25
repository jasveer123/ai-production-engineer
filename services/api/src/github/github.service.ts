import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type {
  GitHubOverview,
  GitHubAppInfo,
  GitHubSelectView,
  Integration,
  RepoCommit,
  RepositoryAccess,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, conflict, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { integrations, services, workspaceMembers, workspaces } from '../db/schema';
import { GitHubAppClient, GitHubError } from './github-app';

type Row = typeof integrations.$inferSelect;

interface GitHubConfig {
  installationId: number;
  accountLogin: string;
  /** Repositories this workspace may use (a subset of the App installation). */
  repositories: string[];
  /** Every repository the App installation currently grants. */
  grantedRepositories?: string[];
  /** Refreshed by check(); absent on rows connected before they were recorded. */
  accountType?: string;
  repositorySelection?: 'all' | 'selected';
  permissions?: Record<string, string>;
}

/** Permissions each automation needs on the GitHub App installation. */
export const NEEDED_PERMISSIONS = {
  setupPullRequest: { contents: 'write', pull_requests: 'write' },
  deployWorkflow: { contents: 'write', pull_requests: 'write', workflows: 'write' },
} as const;

/** "contents: write" style list of what `granted` lacks. */
export function missingPermissions(
  granted: Record<string, string> | undefined,
  needed: Record<string, string>,
): string[] {
  return Object.entries(needed)
    .filter(([k, v]) => {
      const have = granted?.[k];
      return !(have === v || (v === 'read' && have === 'write'));
    })
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
}

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

  /** For tests: swap in a fake client. */
  useClient(client: GitHubAppClient) {
    this.client = client;
  }

  async appInfo(actor?: ActorContext): Promise<GitHubAppInfo> {
    if (!this.configured)
      return {
        configured: false,
        slug: null,
        installUrl: null,
        installations: [],
        connectedElsewhere: [],
      };
    const gh = this.gh();
    try {
      this.slug ??= (await gh.app()).slug;
    } catch (err) {
      if (err instanceof GitHubError && [401, 404].includes(err.status)) {
        throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          'github_app_invalid',
          'GitHub App not found or key rejected: check GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_PATH',
        );
      }
      throw err;
    }
    const claimed = await this.db
      .select({ id: integrations.externalAccountId, workspaceId: integrations.workspaceId })
      .from(integrations)
      .where(and(eq(integrations.provider, 'github'), ne(integrations.status, 'disconnected')));
    const all = await gh.listInstallations();
    // Name other workspaces only to their own members.
    const mine = actor
      ? await this.db
          .select({ id: workspaces.id, name: workspaces.name })
          .from(workspaceMembers)
          .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
          .where(eq(workspaceMembers.userId, actor.userId))
      : [];
    const mineIds = new Set(mine.map((m) => m.id));
    const takenByStrangers = new Set(
      claimed.filter((c) => !mineIds.has(c.workspaceId)).map((c) => c.id),
    );
    const connectedHere = new Set(
      claimed.filter((c) => c.workspaceId === actor?.workspaceId).map((c) => c.id),
    );
    const connectedElsewhere = claimed
      .filter((c) => c.workspaceId !== actor?.workspaceId)
      .map((c) => {
        const inst = all.find((i) => String(i.id) === c.id);
        const ws = mine.find((m) => m.id === c.workspaceId);
        return inst
          ? {
              id: inst.id,
              account: inst.account?.login ?? 'unknown',
              workspaceId: ws?.id ?? null,
              workspaceName: ws?.name ?? null,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const installations = all
      .filter(
        (i) =>
          !i.suspended_at &&
          !takenByStrangers.has(String(i.id)) &&
          !connectedHere.has(String(i.id)),
      )
      .map((i) => ({
        id: i.id,
        account: i.account?.login ?? 'unknown',
        repositorySelection: i.repository_selection,
      }));
    return {
      configured: true,
      slug: this.slug,
      installUrl: `https://github.com/apps/${this.slug}/installations/new`,
      installations,
      connectedElsewhere,
    };
  }

  /**
   * GitHub accounts this workspace can attach, with every repository each installation granted.
   * Used by the post-callback "Select GitHub repositories" page.
   */
  async selectView(actor: ActorContext): Promise<GitHubSelectView> {
    const info = await this.appInfo(actor);
    if (!info.configured) return { configured: false, installUrl: null, accounts: [] };
    const gh = this.gh();
    const here = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'github'),
          ne(integrations.status, 'disconnected'),
        ),
      );
    const connectedIds = new Set(here.map((r) => r.externalAccountId));
    const candidates = [
      ...info.installations.map((i) => i.id),
      ...here.map((r) => Number(r.externalAccountId)),
    ].filter((id, i, arr) => Number.isFinite(id) && arr.indexOf(id) === i);
    const accounts = (
      await Promise.all(
        candidates.map(async (installationId) => {
          try {
            const inst = await gh.getInstallation(installationId);
            if (inst.suspended_at) return null;
            const repos = await gh.listRepositories(installationId);
            const login = inst.account?.login ?? 'unknown';
            const row = here.find((r) => r.externalAccountId === String(installationId));
            const selected = row
              ? ((row.config as unknown as GitHubConfig).repositories ?? []).filter((name) =>
                  repos.some((r) => r.full_name.toLowerCase() === name.toLowerCase()),
                )
              : repos.map((r) => r.full_name);
            return {
              installationId,
              account: login,
              accountType: inst.account?.type ?? null,
              avatarUrl: `https://github.com/${login}.png?size=64`,
              repositorySelection: inst.repository_selection,
              repositories: repos.map((r) => ({
                fullName: r.full_name,
                defaultBranch: r.default_branch,
                private: r.private,
              })),
              selected,
              connected: connectedIds.has(String(installationId)),
              integrationId: row?.id ?? null,
            };
          } catch (err) {
            if (err instanceof GitHubError && err.status === 404) return null;
            throw err;
          }
        }),
      )
    ).filter((a): a is NonNullable<typeof a> => a !== null);
    return { configured: true, installUrl: info.installUrl, accounts };
  }

  /** Connects an installation after validating it and reading which repositories it grants. */
  async connect(
    actor: ActorContext,
    installationId: number,
    name: string,
    repositories?: string[],
  ): Promise<Row> {
    const gh = this.gh();
    let config: GitHubConfig;
    try {
      const inst = await gh.getInstallation(installationId);
      const repos = await gh.listRepositories(installationId);
      const granted = repos.map((r) => r.full_name);
      const selected = this.pickRepositories(granted, repositories);
      config = {
        installationId,
        accountLogin: inst.account?.login ?? 'unknown',
        accountType: inst.account?.type,
        repositorySelection: inst.repository_selection,
        permissions: inst.permissions,
        grantedRepositories: granted,
        repositories: selected,
      };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) throw notFound('GitHub installation');
      throw err;
    }

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
    if (existingHere) {
      const [row] = await this.db
        .update(integrations)
        .set({
          name,
          status: 'connected',
          lastError: null,
          lastSyncAt: new Date(),
          config: { ...config },
        })
        .where(eq(integrations.id, existingHere.id))
        .returning();
      await this.audit.record({
        workspaceId: actor.workspaceId,
        actorId: actor.userId,
        action: 'integration.updated',
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

    const [row] = await this.db
      .insert(integrations)
      .values({
        workspaceId: actor.workspaceId,
        provider: 'github',
        name,
        externalAccountId: String(installationId),
        status: 'connected',
        lastSyncAt: new Date(),
        config: { ...config },
      })
      .returning();
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'integration.created',
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

  private pickRepositories(granted: string[], requested?: string[]): string[] {
    if (!requested) return granted;
    const allowed = new Set(granted.map((r) => r.toLowerCase()));
    const picked = requested.filter((r) => allowed.has(r.toLowerCase()));
    const unique = granted.filter((g) => picked.some((p) => p.toLowerCase() === g.toLowerCase()));
    if (!unique.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'repo_not_granted',
        'Select at least one repository this GitHub App installation can access.',
      );
    }
    return unique;
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
        .where(eq(integrations.id, row.id));
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
    try {
      this.slug ??= (await this.gh().app()).slug;
    } catch {
      // the overview still works without the app's slug
    }
    return {
      configured: true,
      installations,
      missing: installations.length
        ? {
            setupPullRequest: missingPermissions(perms, NEEDED_PERMISSIONS.setupPullRequest),
            deployWorkflow: missingPermissions(perms, NEEDED_PERMISSIONS.deployWorkflow),
          }
        : empty.missing,
      appPermissionsUrl: this.slug
        ? `https://github.com/settings/apps/${this.slug}/permissions`
        : null,
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

  toScope(row: Row): Partial<Integration> {
    const cfg = row.config as unknown as Partial<GitHubConfig>;
    return {
      scope: `Read code and history${cfg.repositories ? ` of ${cfg.repositories.length} repo(s): ${cfg.repositories.join(', ')}` : ''}. Writes only open a pull request on an ai-fix/* branch, after a human approves a validated fix.`,
    };
  }
}
