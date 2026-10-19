import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  hypothesisFeedbackSchema,
  incidentActionSchema,
  type HypothesisFeedbackInput,
  type IncidentActionInput,
  type IncidentInvestigation,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { InvestigationsService } from './investigations.service';

@Controller('workspaces/:workspaceId/incidents/:incidentId')
@UseGuards(WorkspaceAccessGuard)
export class InvestigationsController {
  constructor(private readonly svc: InvestigationsService) {}

  @Get('investigation')
  get(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<IncidentInvestigation> {
    return this.svc.forIncident(actor, id);
  }

  @Get('evidence/:evidenceId')
  evidence(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.svc.evidenceContent(actor, id, evidenceId);
  }

  /** Investigate further, approve reproduction, or dismiss. Signals the incident workflow. */
  @Post('actions')
  @MinRole('engineer')
  @HttpCode(200)
  act(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(incidentActionSchema)) body: IncidentActionInput,
  ): Promise<IncidentInvestigation> {
    return this.svc.act(actor, id, body);
  }

  /** Was this hypothesis right? Feeds the Quality page (Phase 9). */
  @Post('investigation/feedback')
  @MinRole('engineer')
  @HttpCode(200)
  feedback(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(hypothesisFeedbackSchema)) body: HypothesisFeedbackInput,
  ): Promise<IncidentInvestigation> {
    return this.svc.feedback(actor, id, body);
  }
}
