import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createIntegrationSchema,
  type CreateIntegrationInput,
  type DeadLetter,
  type Integration,
  type IntegrationWithSecret,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../../modules/workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { DeadLettersService } from './application/dead-letters.service';
import { IntegrationsService } from './integrations.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class IntegrationsController {
  constructor(
    private readonly svc: IntegrationsService,
    private readonly deadLetterQueue: DeadLettersService,
  ) {}

  @Get('integrations')
  list(@Actor() actor: ActorContext): Promise<Integration[]> {
    return this.svc.list(actor);
  }

  @Post('integrations')
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createIntegrationSchema)) body: CreateIntegrationInput,
  ): Promise<IntegrationWithSecret> {
    return this.svc.create(actor, body);
  }

  @Post('integrations/:integrationId/test')
  @MinRole('admin')
  @HttpCode(200)
  test(
    @Actor() actor: ActorContext,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ): Promise<Integration> {
    return this.svc.test(actor, id);
  }

  @Post('integrations/:integrationId/rotate-secret')
  @MinRole('admin')
  @HttpCode(200)
  rotate(
    @Actor() actor: ActorContext,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ): Promise<IntegrationWithSecret> {
    return this.svc.rotateSecret(actor, id);
  }

  @Delete('integrations/:integrationId')
  @MinRole('admin')
  @HttpCode(204)
  disconnect(
    @Actor() actor: ActorContext,
    @Param('integrationId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.svc.disconnect(actor, id);
  }

  @Get('ingest/dead-letters')
  @MinRole('admin')
  deadLetters(@Actor() actor: ActorContext): Promise<DeadLetter[]> {
    return this.deadLetterQueue.deadLetters(actor);
  }

  @Post('ingest/dead-letters/:eventId/replay')
  @MinRole('admin')
  @HttpCode(204)
  replay(@Actor() actor: ActorContext, @Param('eventId', ParseUUIDPipe) id: string): Promise<void> {
    return this.deadLetterQueue.replayDeadLetter(actor, id);
  }
}
