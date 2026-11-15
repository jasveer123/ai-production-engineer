import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  activityQuerySchema,
  commentSchema,
  escalateIncidentSchema,
  incidentMetadataSchema,
  postMortemSchema,
  responseActionSchema,
  updateIncidentSchema,
  type ActivityPage,
  type CommentInput,
  type EscalateIncidentInput,
  type Incident,
  type IncidentContext,
  type IncidentMetadataInput,
  type PostMortemInput,
  type ResponseActionInput,
  type UpdateIncidentInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { IncidentActivityService } from './application/incident-activity.service';
import { IncidentCollabService } from './application/incident-collab.service';
import { IncidentResponseService } from './application/incident-response.service';

// Every field is optional, so a POST with no body (curl, email links) is a valid action.
const responseAction = new ZodValidationPipe(responseActionSchema.default({}));

@Controller([
  'workspaces/:workspaceId/incidents/:incidentId',
  'api/v1/workspaces/:workspaceId/incidents/:incidentId',
])
@UseGuards(WorkspaceAccessGuard)
export class IncidentResponseController {
  constructor(
    private readonly response: IncidentResponseService,
    private readonly collab: IncidentCollabService,
    private readonly activity: IncidentActivityService,
  ) {}

  @Get('activity')
  activityPage(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) q: { after?: string; limit: number },
  ): Promise<ActivityPage> {
    return this.activity.page(actor, id, q.after, q.limit);
  }

  @Get('context')
  context(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<IncidentContext> {
    return this.activity.context(actor, id);
  }

  @Post('unacknowledge')
  @MinRole('engineer')
  @HttpCode(200)
  unacknowledge(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(responseAction) body: ResponseActionInput,
  ): Promise<Incident> {
    return this.response.respond(actor, id, 'unacknowledge', body);
  }

  @Post('resolve')
  @MinRole('engineer')
  @HttpCode(200)
  resolve(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(responseAction) body: ResponseActionInput,
  ): Promise<Incident> {
    return this.response.respond(actor, id, 'resolve', body);
  }

  @Post('reopen')
  @MinRole('engineer')
  @HttpCode(200)
  reopen(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(responseAction) body: ResponseActionInput,
  ): Promise<Incident> {
    return this.response.respond(actor, id, 'reopen', body);
  }

  @Post('escalate')
  @MinRole('engineer')
  @HttpCode(200)
  escalate(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(escalateIncidentSchema)) body: EscalateIncidentInput,
  ): Promise<Incident> {
    return this.response.escalate(actor, id, body);
  }

  @Patch()
  @MinRole('engineer')
  update(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateIncidentSchema)) body: UpdateIncidentInput,
  ): Promise<Incident> {
    return this.response.update(actor, id, body);
  }

  @Delete()
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.response.remove(actor, id);
  }

  @Post('comments')
  @MinRole('engineer')
  comment(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(commentSchema)) body: CommentInput,
  ): Promise<{ id: string }> {
    return this.collab.addComment(actor, id, body.body);
  }

  @Patch('comments/:commentId')
  @MinRole('engineer')
  @HttpCode(204)
  editComment(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body(new ZodValidationPipe(commentSchema)) body: CommentInput,
  ): Promise<void> {
    return this.collab.editComment(actor, id, commentId, body.body);
  }

  @Delete('comments/:commentId')
  @MinRole('engineer')
  @HttpCode(204)
  deleteComment(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    return this.collab.deleteComment(actor, id, commentId);
  }

  @Put('post-mortem')
  @MinRole('engineer')
  postMortem(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(postMortemSchema)) body: PostMortemInput,
  ): Promise<Incident> {
    return this.collab.savePostMortem(actor, id, body.body);
  }

  @Put('metadata')
  @MinRole('engineer')
  metadata(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(incidentMetadataSchema)) body: IncidentMetadataInput,
  ): Promise<Incident> {
    return this.collab.setMetadata(actor, id, body);
  }
}
