import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  bulkCreateMonitorsSchema,
  createMonitorSchema,
  updateMonitorSchema,
  type BulkCreateMonitorsResult,
  type CreateMonitorValues,
  type MonitorDetail,
  type MonitorView,
  type UpdateMonitorInput,
} from '@ape/api-contracts';
import { z } from 'zod';
import { Actor } from '../../core/common/actor.decorator';
import { notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { Public } from '../auth/public.decorator';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { MonitorsService } from './application/monitors.service';

type BulkBody = z.infer<typeof bulkCreateMonitorsSchema>;

@Controller(['workspaces/:workspaceId/monitors', 'api/v1/workspaces/:workspaceId/monitors'])
@UseGuards(WorkspaceAccessGuard)
export class MonitorsController {
  constructor(private readonly monitors: MonitorsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<MonitorView[]> {
    return this.monitors.list(actor);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createMonitorSchema)) body: CreateMonitorValues,
  ): Promise<MonitorView> {
    return this.monitors.create(actor, body);
  }

  @Post('bulk')
  @MinRole('admin')
  bulkCreate(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(bulkCreateMonitorsSchema)) body: BulkBody,
  ): Promise<BulkCreateMonitorsResult> {
    return this.monitors.bulkCreate(actor, body.urls, body.intervalSeconds);
  }

  @Get(':monitorId')
  get(
    @Actor() actor: ActorContext,
    @Param('monitorId', ParseUUIDPipe) id: string,
  ): Promise<MonitorDetail> {
    return this.monitors.get(actor, id);
  }

  @Patch(':monitorId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('monitorId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMonitorSchema)) body: UpdateMonitorInput,
  ): Promise<MonitorView> {
    return this.monitors.update(actor, id, body);
  }

  @Delete(':monitorId')
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('monitorId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.monitors.remove(actor, id);
  }

  @Post(':monitorId/check')
  @MinRole('engineer')
  @HttpCode(200)
  check(
    @Actor() actor: ActorContext,
    @Param('monitorId', ParseUUIDPipe) id: string,
  ): Promise<MonitorDetail> {
    return this.monitors.checkNow(actor, id);
  }

  @Post(':monitorId/test-alert')
  @MinRole('engineer')
  @HttpCode(204)
  testAlert(
    @Actor() actor: ActorContext,
    @Param('monitorId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.monitors.sendTestAlert(actor, id);
  }
}

@Controller('badges/monitors')
export class MonitorBadgeController {
  constructor(private readonly monitors: MonitorsService) {}

  @Public()
  @Get(':file')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=60')
  async badge(@Param('file') file: string): Promise<string> {
    const svg = await this.monitors.badge(file.replace(/\.svg$/, ''));
    if (!svg) throw notFound('Badge');
    return svg;
  }
}
