import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { PullRequestView } from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { PullsService } from './pulls.service';

@Controller('workspaces/:workspaceId/pull-requests')
@UseGuards(WorkspaceAccessGuard)
export class PullsController {
  constructor(private readonly svc: PullsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<PullRequestView[]> {
    return this.svc.list(actor);
  }

  @Post(':id/sync')
  @MinRole('engineer')
  @HttpCode(200)
  refresh(
    @Actor() actor: ActorContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PullRequestView> {
    return this.svc.refresh(actor, id);
  }
}
