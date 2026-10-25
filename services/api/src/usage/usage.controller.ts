import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { workspaceLimitsSchema, type UsageSummary, type WorkspaceLimits } from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { UsageService } from './usage.service';

@Controller('workspaces/:workspaceId/usage')
@UseGuards(WorkspaceAccessGuard)
export class UsageController {
  constructor(private readonly svc: UsageService) {}

  @Get()
  @MinRole('admin')
  summary(@Actor() actor: ActorContext): Promise<UsageSummary> {
    return this.svc.summary(actor);
  }

  @Put('limits')
  @MinRole('owner')
  setLimits(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(workspaceLimitsSchema)) body: WorkspaceLimits,
  ): Promise<UsageSummary> {
    return this.svc.setLimits(actor, body);
  }
}
