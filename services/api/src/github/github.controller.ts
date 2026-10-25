import { Body, Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Post } from '@nestjs/common';
import {
  connectGitHubSchema,
  type ConnectGitHubInput,
  type GitHubAppInfo,
  type GitHubSelectView,
  type Integration,
  type RepoCommit,
  type RepositoryAccess,
  type GitHubOverview,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { IntegrationsService } from '../integrations/integrations.service';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { GitHubService } from './github.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class GitHubController {
  constructor(
    private readonly github: GitHubService,
    private readonly integrations: IntegrationsService,
  ) {}

  @Get('github/app')
  @MinRole('admin')
  app(@Actor() actor: ActorContext): Promise<GitHubAppInfo> {
    return this.github.appInfo(actor);
  }

  @Post('github/connect')
  @MinRole('admin')
  async connect(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(connectGitHubSchema)) body: ConnectGitHubInput,
  ): Promise<Integration> {
    const row = await this.github.connect(
      actor,
      body.installationId,
      body.name ?? 'GitHub',
      body.repositories,
    );
    return this.integrations.toDto(row);
  }

  @Get('github/select')
  @MinRole('admin')
  select(@Actor() actor: ActorContext): Promise<GitHubSelectView> {
    return this.github.selectView(actor);
  }

  @Get('github/overview')
  overview(@Actor() actor: ActorContext): Promise<GitHubOverview> {
    return this.github.overview(actor);
  }

  @Get('github/repository-access')
  repositoryAccess(@Actor() actor: ActorContext): Promise<RepositoryAccess[]> {
    return this.github.repositoryAccess(actor);
  }

  @Get('services/:serviceId/commits')
  commits(
    @Actor() actor: ActorContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query('limit') limit?: string,
  ): Promise<RepoCommit[]> {
    return this.github.recentCommits(
      actor,
      serviceId,
      Math.min(20, Math.max(1, Number(limit) || 5)),
    );
  }
}
