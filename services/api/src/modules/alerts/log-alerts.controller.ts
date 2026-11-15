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
  createLogAlertSchema,
  updateLogAlertSchema,
  type CreateLogAlertInput,
  type LogAlertView,
  type UpdateLogAlertInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { LogAlertsService } from './application/log-alerts.service';

@Controller('workspaces/:workspaceId/log-alerts')
@UseGuards(WorkspaceAccessGuard)
export class LogAlertsController {
  constructor(private readonly logAlerts: LogAlertsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<LogAlertView[]> {
    return this.logAlerts.list(actor);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createLogAlertSchema)) body: Required<CreateLogAlertInput>,
  ): Promise<LogAlertView> {
    return this.logAlerts.create(actor, body);
  }

  @Patch(':alertId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('alertId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLogAlertSchema)) body: UpdateLogAlertInput,
  ): Promise<LogAlertView> {
    return this.logAlerts.update(actor, id, body);
  }

  @Delete(':alertId')
  @MinRole('admin')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('alertId', ParseUUIDPipe) id: string): Promise<void> {
    return this.logAlerts.remove(actor, id);
  }

  @Post(':alertId/check')
  @MinRole('engineer')
  @HttpCode(200)
  check(
    @Actor() actor: ActorContext,
    @Param('alertId', ParseUUIDPipe) id: string,
  ): Promise<LogAlertView> {
    return this.logAlerts.checkNow(actor, id);
  }
}
