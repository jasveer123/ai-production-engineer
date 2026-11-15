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
  createErrorAppSchema,
  updateErrorAppSchema,
  type CreateErrorAppInput,
  type ErrorAppView,
  type UpdateErrorAppInput,
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
import { ErrorAppsService } from './application/error-apps.service';
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

@Controller('workspaces/:workspaceId/error-applications')
@UseGuards(WorkspaceAccessGuard)
export class ErrorAppsController {
  constructor(private readonly apps: ErrorAppsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<ErrorAppView[]> {
    return this.apps.list(actor);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createErrorAppSchema)) body: CreateErrorAppInput,
  ): Promise<ErrorAppView> {
    return this.apps.create(actor, body);
  }

  @Patch(':appId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('appId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateErrorAppSchema)) body: UpdateErrorAppInput,
  ): Promise<ErrorAppView> {
    return this.apps.update(actor, id, body);
  }

  @Delete(':appId')
  @MinRole('admin')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('appId', ParseUUIDPipe) id: string): Promise<void> {
    return this.apps.remove(actor, id);
  }
}
