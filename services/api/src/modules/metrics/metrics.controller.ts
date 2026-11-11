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
  createDashboardSchema,
  metricQuerySchema,
  updateDashboardSchema,
  type CreateDashboardInput,
  type DashboardView,
  type MetricLabelKey,
  type MetricName,
  type MetricSeries,
  type UpdateDashboardInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { MetricsService } from './application/metrics.service';

@Controller('workspaces/:workspaceId/metrics')
@UseGuards(WorkspaceAccessGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('names')
  names(@Actor() actor: ActorContext): Promise<MetricName[]> {
    return this.metrics.names(actor);
  }

  @Get('labels')
  labels(@Actor() actor: ActorContext, @Query('name') name: string): Promise<MetricLabelKey[]> {
    return this.metrics.labels(actor, name ?? '');
  }

  @Get('series')
  series(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(metricQuerySchema))
    query: ReturnType<typeof metricQuerySchema.parse>,
  ): Promise<MetricSeries> {
    return this.metrics.series(actor, query);
  }

  @Get('dashboards')
  list(@Actor() actor: ActorContext): Promise<DashboardView[]> {
    return this.metrics.listDashboards(actor);
  }

  @Post('dashboards')
  @MinRole('engineer')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createDashboardSchema)) body: CreateDashboardInput,
  ): Promise<DashboardView> {
    return this.metrics.createDashboard(actor, body);
  }

  @Patch('dashboards/:dashboardId')
  @MinRole('engineer')
  update(
    @Actor() actor: ActorContext,
    @Param('dashboardId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDashboardSchema)) body: UpdateDashboardInput,
  ): Promise<DashboardView> {
    return this.metrics.updateDashboard(actor, id, body);
  }

  @Delete('dashboards/:dashboardId')
  @MinRole('engineer')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('dashboardId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.metrics.removeDashboard(actor, id);
  }
}
