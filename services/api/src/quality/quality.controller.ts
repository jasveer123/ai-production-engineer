import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { qualityQuerySchema, type QualitySummary } from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { QualityService } from './quality.service';

@Controller('workspaces/:workspaceId/quality')
@UseGuards(WorkspaceAccessGuard)
export class QualityController {
  constructor(private readonly svc: QualityService) {}

  /** Outcome-based quality of investigations and fixes over the last `days` days (Phase 9). */
  @Get()
  get(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(qualityQuerySchema)) q: { days: number },
  ): Promise<QualitySummary> {
    return this.svc.summary(actor, q.days);
  }
}
