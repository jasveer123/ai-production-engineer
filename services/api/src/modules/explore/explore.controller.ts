import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createSavedQuerySchema,
  logContextQuerySchema,
  logExploreQuerySchema,
  logFacetsQuerySchema,
  rangeQuerySchema,
  tailQuerySchema,
  traceSearchQuerySchema,
  type CreateSavedQueryInput,
  type LogContext,
  type LogExploreResult,
  type LogFacets,
  type OperationStats,
  type SavedQuery,
  type ServiceMap,
  type SourcesOverview,
  type TailResult,
  type TraceDetail,
  type TraceSearchResult,
} from '@ape/api-contracts';
import type { z } from 'zod';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { LogsExplorerService } from './application/logs-explorer.service';
import { SavedQueriesService } from './application/saved-queries.service';
import { ServiceMapService } from './application/service-map.service';
import { SourcesService } from './application/sources.service';
import { TracesExplorerService } from './application/traces-explorer.service';

const pipe = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

@Controller('workspaces/:workspaceId/explore')
@UseGuards(WorkspaceAccessGuard)
export class ExploreController {
  constructor(
    private readonly logs: LogsExplorerService,
    private readonly traces: TracesExplorerService,
    private readonly serviceMap: ServiceMapService,
    private readonly saved: SavedQueriesService,
    private readonly sources: SourcesService,
  ) {}

  @Get('logs')
  searchLogs(
    @Actor() actor: ActorContext,
    @Query(pipe(logExploreQuerySchema)) q: z.output<typeof logExploreQuerySchema>,
  ): Promise<LogExploreResult> {
    return this.logs.search(actor.workspaceId, q);
  }

  @Get('logs/facets')
  facets(
    @Actor() actor: ActorContext,
    @Query(pipe(logFacetsQuerySchema)) q: z.output<typeof logFacetsQuerySchema>,
  ): Promise<LogFacets> {
    return this.logs.facets(actor.workspaceId, q);
  }

  @Get('logs/tail')
  tail(
    @Actor() actor: ActorContext,
    @Query(pipe(tailQuerySchema)) q: z.output<typeof tailQuerySchema>,
  ): Promise<TailResult> {
    return this.logs.tail(actor.workspaceId, q);
  }

  @Get('logs/:logId/context')
  context(
    @Actor() actor: ActorContext,
    @Param('logId', ParseIntPipe) id: number,
    @Query(pipe(logContextQuerySchema)) q: z.output<typeof logContextQuerySchema>,
  ): Promise<LogContext> {
    return this.logs.context(actor.workspaceId, id, q.size);
  }

  @Get('traces')
  searchTraces(
    @Actor() actor: ActorContext,
    @Query(pipe(traceSearchQuerySchema)) q: z.output<typeof traceSearchQuerySchema>,
  ): Promise<TraceSearchResult> {
    return this.traces.search(actor.workspaceId, q);
  }

  @Get('traces/operations')
  operations(
    @Actor() actor: ActorContext,
    @Query(pipe(rangeQuerySchema)) q: z.output<typeof rangeQuerySchema>,
  ): Promise<OperationStats[]> {
    return this.traces.operations(actor.workspaceId, q);
  }

  @Get('traces/:traceId')
  trace(@Actor() actor: ActorContext, @Param('traceId') traceId: string): Promise<TraceDetail> {
    return this.traces.detail(actor.workspaceId, traceId.slice(0, 64));
  }

  @Get('service-map')
  map(
    @Actor() actor: ActorContext,
    @Query(pipe(rangeQuerySchema)) q: z.output<typeof rangeQuerySchema>,
  ): Promise<ServiceMap> {
    return this.serviceMap.map(actor.workspaceId, q);
  }

  @Get('saved-queries')
  listSaved(@Actor() actor: ActorContext, @Query('signal') signal?: string): Promise<SavedQuery[]> {
    return this.saved.list(actor, signal === 'logs' || signal === 'traces' ? signal : undefined);
  }

  @Post('saved-queries')
  @MinRole('engineer')
  createSaved(
    @Actor() actor: ActorContext,
    @Body(pipe(createSavedQuerySchema)) body: CreateSavedQueryInput,
  ): Promise<SavedQuery> {
    return this.saved.create(actor, body);
  }

  @Delete('saved-queries/:id')
  @MinRole('engineer')
  @HttpCode(204)
  removeSaved(@Actor() actor: ActorContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.saved.remove(actor, id);
  }

  @Get('sources')
  sourcesOverview(@Actor() actor: ActorContext): Promise<SourcesOverview> {
    return this.sources.overview(actor.workspaceId);
  }

  @Post('sources/:id/pause')
  @MinRole('admin')
  @HttpCode(204)
  pause(@Actor() actor: ActorContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sources.setPaused(actor, id, true);
  }

  @Post('sources/:id/resume')
  @MinRole('admin')
  @HttpCode(204)
  resume(@Actor() actor: ActorContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sources.setPaused(actor, id, false);
  }
}
