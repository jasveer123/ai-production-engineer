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
  askSchema,
  type AskInput,
  type ChatConversationDetail,
  type ChatConversationView,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { AssistantService } from './application/assistant.service';

@Controller('workspaces/:workspaceId/assistant/conversations')
@UseGuards(WorkspaceAccessGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<ChatConversationView[]> {
    return this.assistant.list(actor);
  }

  @Post()
  @MinRole('engineer')
  @HttpCode(201)
  start(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(askSchema)) body: AskInput,
  ): Promise<ChatConversationDetail> {
    return this.assistant.ask(actor, null, body.message);
  }

  @Get(':conversationId')
  get(
    @Actor() actor: ActorContext,
    @Param('conversationId', ParseUUIDPipe) id: string,
  ): Promise<ChatConversationDetail> {
    return this.assistant.get(actor, id);
  }

  @Post(':conversationId/messages')
  @MinRole('engineer')
  @HttpCode(200)
  ask(
    @Actor() actor: ActorContext,
    @Param('conversationId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(askSchema)) body: AskInput,
  ): Promise<ChatConversationDetail> {
    return this.assistant.ask(actor, id, body.message);
  }

  @Delete(':conversationId')
  @MinRole('engineer')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('conversationId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.assistant.remove(actor, id);
  }
}
