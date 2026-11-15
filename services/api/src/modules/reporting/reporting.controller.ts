import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  reportQuerySchema,
  type IncidentsOverview,
  type MonitorReportRow,
  type NotificationVolumeRow,
  type ReportQuery,
  type ResponderReportRow,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { ReportingService } from './application/reporting.service';

const query = new ZodValidationPipe(reportQuerySchema);

@Controller('workspaces/:workspaceId/reporting')
@UseGuards(WorkspaceAccessGuard)
export class ReportingController {
  constructor(private readonly reports: ReportingService) {}

  @Get('incidents')
  incidents(
    @Actor() actor: ActorContext,
    @Query(query) q: ReportQuery,
  ): Promise<IncidentsOverview> {
    return this.reports.incidents(actor.workspaceId, q);
  }

  @Get('monitors')
  monitors(
    @Actor() actor: ActorContext,
    @Query(query) q: ReportQuery,
  ): Promise<MonitorReportRow[]> {
    return this.reports.monitors(actor.workspaceId, q);
  }

  @Get('responders')
  responders(
    @Actor() actor: ActorContext,
    @Query(query) q: ReportQuery,
  ): Promise<ResponderReportRow[]> {
    return this.reports.responders(actor.workspaceId, q);
  }

  @Get('notifications')
  notifications(
    @Actor() actor: ActorContext,
    @Query(query) q: ReportQuery,
  ): Promise<NotificationVolumeRow[]> {
    return this.reports.notifications(actor.workspaceId, q);
  }
}
