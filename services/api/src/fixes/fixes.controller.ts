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
import { fixActionSchema, type FixActionInput, type IncidentFixes } from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { FixesService } from './fixes.service';

@Controller('workspaces/:workspaceId/incidents/:incidentId/fixes')
@UseGuards(WorkspaceAccessGuard)
export class FixesController {
  constructor(private readonly svc: FixesService) {}

  @Get()
  get(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<IncidentFixes> {
    return this.svc.forIncident(actor, id);
  }

  /** Regenerate, reject, or approve the validated fix for a pull request (Phase 6 opens it). */
  @Post('actions')
  @MinRole('engineer')
  @HttpCode(200)
  act(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(fixActionSchema)) body: FixActionInput,
  ): Promise<IncidentFixes> {
    return this.svc.act(actor, id, body);
  }
}
