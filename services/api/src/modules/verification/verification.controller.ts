import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { IncidentVerification } from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { VerificationService } from './verification.service';

@Controller('workspaces/:workspaceId/incidents/:incidentId/verification')
@UseGuards(WorkspaceAccessGuard)
export class VerificationController {
  constructor(private readonly svc: VerificationService) {}

  @Get()
  get(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<IncidentVerification> {
    return this.svc.forIncident(actor, id);
  }
}
