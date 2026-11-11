import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  errorListQuerySchema,
  updateErrorSchema,
  type ErrorGroupDetail,
  type ErrorGroupView,
  type UpdateErrorInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { ErrorsService } from './application/errors.service';

@Controller('workspaces/:workspaceId/errors')
@UseGuards(WorkspaceAccessGuard)
export class ErrorsController {
  constructor(private readonly errors: ErrorsService) {}

  @Get()
  list(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(errorListQuerySchema))
    query: ReturnType<typeof errorListQuerySchema.parse>,
  ): Promise<ErrorGroupView[]> {
    return this.errors.list(actor, query);
  }

  @Get(':errorId')
  get(
    @Actor() actor: ActorContext,
    @Param('errorId', ParseUUIDPipe) id: string,
  ): Promise<ErrorGroupDetail> {
    return this.errors.get(actor, id);
  }

  @Patch(':errorId')
  @MinRole('engineer')
  update(
    @Actor() actor: ActorContext,
    @Param('errorId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateErrorSchema)) body: UpdateErrorInput,
  ): Promise<ErrorGroupView> {
    return this.errors.setStatus(actor, id, body);
  }
}
