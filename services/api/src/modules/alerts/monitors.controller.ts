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
  UseGuards,
} from '@nestjs/common';
import {
  createMonitorSchema,
  updateMonitorSchema,
  type CreateMonitorInput,
  type MonitorDetail,
  type MonitorView,
  type UpdateMonitorInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { MonitorsService } from './application/monitors.service';

@Controller('workspaces/:workspaceId/monitors')
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
    @Body(new ZodValidationPipe(createMonitorSchema)) body: Required<CreateMonitorInput>,
  ): Promise<MonitorView> {
    return this.monitors.create(actor, body);
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
}
