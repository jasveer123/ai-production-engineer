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
  createMetricAlertSchema,
  updateMetricAlertSchema,
  type MetricAlertView,
  type UpdateMetricAlertInput,
} from '@ape/api-contracts';
import type { z } from 'zod';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { MetricAlertsService } from './application/metric-alerts.service';

@Controller('workspaces/:workspaceId/metric-alerts')
@UseGuards(WorkspaceAccessGuard)
export class MetricAlertsController {
  constructor(private readonly alerts: MetricAlertsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<MetricAlertView[]> {
    return this.alerts.list(actor);
  }

  @Post()
  @MinRole('engineer')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createMetricAlertSchema))
    body: z.output<typeof createMetricAlertSchema>,
  ): Promise<MetricAlertView> {
    return this.alerts.create(actor, body);
  }

  @Patch(':alertId')
  @MinRole('engineer')
  update(
    @Actor() actor: ActorContext,
    @Param('alertId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMetricAlertSchema)) body: UpdateMetricAlertInput,
  ): Promise<MetricAlertView> {
    return this.alerts.update(actor, id, body);
  }

  @Delete(':alertId')
  @MinRole('engineer')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('alertId', ParseUUIDPipe) id: string): Promise<void> {
    return this.alerts.remove(actor, id);
  }

  @Post(':alertId/check')
  @MinRole('engineer')
  @HttpCode(200)
  check(
    @Actor() actor: ActorContext,
    @Param('alertId', ParseUUIDPipe) id: string,
  ): Promise<MetricAlertView> {
    return this.alerts.checkNow(actor, id);
  }
}
