import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { GitHubAppInfo, GitHubSelectView } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { integrations, workspaceMembers, workspaces } from '../../../core/db/schema';
import { GitHubError } from '../infrastructure/github-app';
import type { GitHubConfig } from '../github-config';
import { GitHubService } from '../github.service';

@Injectable()
export class GitHubSelectService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly github: GitHubService,
  ) {}

  async appInfo(actor?: ActorContext): Promise<GitHubAppInfo> {
    if (!this.github.configured)
      return {
        configured: false,
        slug: null,
        installUrl: null,
        installations: [],
        connectedElsewhere: [],
      };
    const gh = this.github.gh();
    let slug: string | null;
    try {
      slug = await this.github.appSlug();
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
      slug,
      installUrl: `https://github.com/apps/${slug}/installations/new`,
      installations,
      connectedElsewhere,
    };
  }

  async selectView(actor: ActorContext): Promise<GitHubSelectView> {
    const info = await this.appInfo(actor);
    if (!info.configured) return { configured: false, installUrl: null, accounts: [] };
    const gh = this.github.gh();
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
}
