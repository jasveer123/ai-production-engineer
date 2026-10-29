import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { OAuthCallbackResult, SetupPrResult } from '@ape/api-contracts';
import { ApiException } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { inboundEvents, integrations } from '../../../core/db/schema';
import { GitHubService } from '../../github/github.service';
import { deployPayloadSchema } from '../../../ingest/ingestion/domain/normalize';
import { OidcError, verifyGitHubOidc } from '../infrastructure/github-oidc';
import { OAuthStateService } from './oauth-state.service';
import { apiUrl, ingestUrl } from '../domain/setup-config';
import {
  deployChanges,
  ensureBranch,
  mapGitHubError,
  openOrReusePull,
  projectChanges,
  requireInstallation,
  setupBranchName,
  setupPrTitle,
  type RepoTarget,
  type SetupPrRequest,
} from '../setup-pr-flow';
import { SetupSupport } from './setup-support.service';

@Injectable()
export class GitHubSetupService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly support: SetupSupport,
    private readonly state: OAuthStateService,
    private readonly github: GitHubService,
  ) {}

  githubState(actor: ActorContext) {
    return this.state.issue(actor, 'github');
  }

  async githubCallback(
    actor: ActorContext,
    installationId: number,
    state: string,
  ): Promise<OAuthCallbackResult> {
    await this.state.verify(actor, 'github', state);
    const [mine] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.workspaceId, actor.workspaceId),
          eq(integrations.provider, 'github'),
          eq(integrations.externalAccountId, String(installationId)),
          ne(integrations.status, 'disconnected'),
        ),
      );

    if (mine) {
      const [row] = await this.db.select().from(integrations).where(eq(integrations.id, mine.id));
      const updated = await this.github.check(row!);
      return {
        provider: 'github',
        done: [
          `GitHub access updated: ${(updated.config as { repositories?: string[] }).repositories?.length ?? 0} repositories.`,
        ],
        todo: [],
        githubInstallationId: installationId,
      };
    }
    return {
      provider: 'github',
      done: [],
      todo: ['Select which repositories this workspace can use.'],
      githubInstallationId: installationId,
    };
  }

  async openSetupPr(actor: ActorContext, input: SetupPrRequest): Promise<SetupPrResult> {
    const inst = requireInstallation(await this.github.overview(actor), input);
    const target: RepoTarget = {
      gh: this.github.gh(),
      installationId: inst.installationId,
      repo: input.repository,
    };
    try {
      return await this.openPullRequest(actor, target, input);
    } catch (err) {
      throw mapGitHubError(err);
    }
  }

  private async openPullRequest(
    actor: ActorContext,
    target: RepoTarget,
    input: SetupPrRequest,
  ): Promise<SetupPrResult> {
    const { gh, installationId, repo } = target;
    const meta = await gh.getRepo(installationId, repo);
    const baseSha = await gh.getBranchSha(installationId, repo, meta.default_branch);
    if (!baseSha)
      throw new ApiException(
        HttpStatus.CONFLICT,
        'empty_repo',
        'The repository has no commits yet',
      );
    const changes =
      input.kind === 'deploy'
        ? deployChanges(
            input,
            { apiUrl: apiUrl(this.env), audience: this.env.GITHUB_OIDC_AUDIENCE },
            meta.default_branch,
          )
        : await projectChanges(target, input, baseSha, ingestUrl(this.env));

    const branch = setupBranchName(input);
    const title = setupPrTitle(input);
    const branchExisted = await ensureBranch(target, {
      branch,
      title,
      baseSha,
      files: changes.files,
    });
    const { pr, draft, reused } = await openOrReusePull(target, {
      branch,
      title,
      base: meta.default_branch,
      kind: input.kind,
      changes,
    });
    await this.support.record(actor, 'setup.pull_request', {
      target: `${repo}#${pr.number}`,
      kind: input.kind,
      service: input.service,
    });
    return {
      url: pr.html_url,
      number: pr.number,
      draft,
      existing: branchExisted || reused,
      language: changes.language,
      done: changes.done,
      todo: changes.todo,
    };
  }

  async githubDeploy(
    bearer: string | undefined,
    body: unknown,
    correlationId: string,
  ): Promise<{ accepted: boolean; duplicate: boolean }> {
    const claims = await this.verifyDeployToken(bearer, correlationId);
    const parsed = deployPayloadSchema.safeParse(body);
    if (!parsed.success)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'validation_failed',
        parsed.error.issues[0]?.message ?? 'Invalid body',
      );

    const rows = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.provider, 'github'), ne(integrations.status, 'disconnected')));
    const owner = rows.find((r) =>
      ((r.config as { repositories?: string[] }).repositories ?? []).some(
        (x) => x.toLowerCase() === claims.repository.toLowerCase(),
      ),
    );
    if (!owner)
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'repo_not_connected',
        `${claims.repository} is not connected to any workspace`,
      );
    const inserted = await this.db
      .insert(inboundEvents)
      .values({
        workspaceId: owner.workspaceId,
        integrationId: owner.id,
        source: 'deploy_webhook',
        externalEventId: `gha:${claims.repository}:${claims.run_id ?? claims.jti ?? ''}:${parsed.data.service}:${parsed.data.commit_sha}`,
        payload: { ...parsed.data, repository: claims.repository },
      })
      .onConflictDoNothing()
      .returning({ id: inboundEvents.id });
    return { accepted: true, duplicate: inserted.length === 0 };
  }

  private async verifyDeployToken(bearer: string | undefined, correlationId: string) {
    try {
      return await verifyGitHubOidc(bearer ?? '', this.env.GITHUB_OIDC_AUDIENCE, this.support.jwks);
    } catch (err) {
      await this.support.auditRejectedDeploy(correlationId, (err as Error).message);
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_token',
        err instanceof OidcError ? err.message : 'Invalid token',
      );
    }
  }
}
