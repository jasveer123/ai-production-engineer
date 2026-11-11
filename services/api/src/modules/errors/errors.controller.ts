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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  errorListQuerySchema,
  sourceMapSchema,
  updateErrorSchema,
  type ErrorGroupDetail,
  type ErrorGroupView,
  type ErrorRelease,
  type SourceMapInput,
  type SourceMapView,
  type UpdateErrorInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { ErrorsService } from './application/errors.service';
import { SourceMapsService } from './application/source-maps.service';

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

  @Get('releases')
  releases(@Actor() actor: ActorContext): Promise<ErrorRelease[]> {
    return this.errors.releases(actor);
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
    return this.errors.update(actor, id, body);
  }
}

@Controller('workspaces/:workspaceId/source-maps')
@UseGuards(WorkspaceAccessGuard)
export class SourceMapsController {
  constructor(private readonly maps: SourceMapsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<SourceMapView[]> {
    return this.maps.list(actor);
  }

  @Post()
  @MinRole('engineer')
  upload(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(sourceMapSchema)) body: SourceMapInput,
  ): Promise<SourceMapView> {
    return this.maps.upload(actor, body);
  }

  @Delete(':mapId')
  @MinRole('engineer')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('mapId', ParseUUIDPipe) id: string): Promise<void> {
    return this.maps.remove(actor, id);
  }
}
