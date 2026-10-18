import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { GitHubAppInfo, Integration, RepoCommit, RepositoryAccess } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, conflict, notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { integrations, services } from '../db/schema';
import { GitHubAppClient, GitHubError } from './github-app';

type Row = typeof integrations.$inferSelect;

interface GitHubConfig {
  installationId: number;
  accountLogin: string;
  repositories: string[];
}

/**
 * GitHub App integration (ADR-009). The workspace stores only the installation id; tokens are
 * minted on demand. Revocation (uninstall) is detected by the health check and stops all access.
 *
 * Limitation (local MVP): an admin picks from the App's unclaimed installations. Production adds
 * the App's setup URL with a signed `state` and a user-to-server check that the admin can see the
 * installation, so one tenant can never claim another's installation.
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

  async appInfo(): Promise<GitHubAppInfo> {
    if (!this.configured)
      return { configured: false, slug: null, installUrl: null, installations: [] };
    const gh = this.gh();
    this.slug ??= (await gh.app()).slug;
    const claimed = await this.db
      .select({ id: integrations.externalAccountId })
      .from(integrations)
      .where(and(eq(integrations.provider, 'github'), ne(integrations.status, 'disconnected')));
    const taken = new Set(claimed.map((c) => c.id));
    const installations = (await gh.listInstallations())
      .filter((i) => !taken.has(String(i.id)) && !i.suspended_at)
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
    };
  }

  /** Connects an installation after validating it and reading which repositories it grants. */
  async connect(actor: ActorContext, installationId: number, name: string): Promise<Row> {
    const gh = this.gh();
    const [existing] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, 'github'),
          eq(integrations.externalAccountId, String(installationId)),
          ne(integrations.status, 'disconnected'),
        ),
      );
    if (existing) throw conflict('This GitHub installation is already connected to a workspace');

    let config: GitHubConfig;
    try {
      const inst = await gh.getInstallation(installationId);
      const repos = await gh.listRepositories(installationId);
      config = {
        installationId,
        accountLogin: inst.account?.login ?? 'unknown',
        repositories: repos.map((r) => r.full_name),
      };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) throw notFound('GitHub installation');
      throw err;
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
        patch = {
          status: 'connected',
          lastError: null,
          lastSyncAt: new Date(),
          config: { ...cfg, repositories: repos.map((r) => r.full_name) },
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
    const [updated] = await this.db
      .update(integrations)
      .set(patch)
      .where(eq(integrations.id, row.id))
      .returning();
    if (row.status !== 'disconnected' && updated!.status === 'disconnected') {
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
    return updated!;
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

  toScope(row: Row): Partial<Integration> {
    const cfg = row.config as unknown as Partial<GitHubConfig>;
    return {
      scope: `Read code and history${cfg.repositories ? ` of ${cfg.repositories.length} repo(s): ${cfg.repositories.join(', ')}` : ''}. Write access is only used after an approved fix (Phase 6).`,
    };
  }
}
