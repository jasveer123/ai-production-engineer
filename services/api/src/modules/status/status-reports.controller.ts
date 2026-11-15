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
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  createReportSchema,
  editReportSchema,
  editUpdateSchema,
  maintenanceSchema,
  reportUpdateSchema,
  type CreateReportInput,
  type CreatedReport,
  type EditReportInput,
  type EditUpdateInput,
  type MaintenanceInput,
  type MaintenanceView,
  type ReportUpdateInput,
  type ReportView,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { MaintenanceService } from './application/maintenance.service';
import { ReportsService } from './application/reports.service';
import { StatusService } from './application/status.service';

@Controller([
  'workspaces/:workspaceId/status-pages/:pageId',
  'api/v1/workspaces/:workspaceId/status-pages/:pageId',
])
@UseGuards(WorkspaceAccessGuard)
export class StatusReportsController {
  constructor(
    private readonly status: StatusService,
    private readonly reports: ReportsService,
    private readonly maintenance: MaintenanceService,
  ) {}

  @Get('reports')
  async list(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<ReportView[]> {
    return this.reports.list((await this.status.find(actor, id)).id);
  }

  @Post('reports')
  @MinRole('engineer')
  async create(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createReportSchema)) body: CreateReportInput,
  ): Promise<CreatedReport> {
    return this.reports.create(await this.status.find(actor, id), body);
  }

  @Patch('reports/:reportId')
  @MinRole('engineer')
  @HttpCode(204)
  async edit(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body(new ZodValidationPipe(editReportSchema)) body: EditReportInput,
  ): Promise<void> {
    await this.reports.edit(await this.status.find(actor, id), reportId, body);
  }

  @Delete('reports/:reportId')
  @MinRole('engineer')
  @HttpCode(204)
  async remove(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
  ): Promise<void> {
    await this.reports.remove((await this.status.find(actor, id)).id, reportId);
  }

  @Post('reports/:reportId/updates')
  @MinRole('engineer')
  async addUpdate(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body(new ZodValidationPipe(reportUpdateSchema)) body: ReportUpdateInput,
  ): Promise<CreatedReport> {
    return this.reports.addUpdate(await this.status.find(actor, id), reportId, body);
  }

  @Patch('reports/:reportId/updates/:updateId')
  @MinRole('engineer')
  @HttpCode(204)
  async editUpdate(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('updateId', ParseUUIDPipe) updateId: string,
    @Body(new ZodValidationPipe(editUpdateSchema)) body: EditUpdateInput,
  ): Promise<void> {
    await this.reports.editUpdate((await this.status.find(actor, id)).id, reportId, updateId, body);
  }

  @Delete('reports/:reportId/updates/:updateId')
  @MinRole('engineer')
  @HttpCode(204)
  async removeUpdate(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ): Promise<void> {
    await this.reports.removeUpdate((await this.status.find(actor, id)).id, reportId, updateId);
  }

  @Get('maintenance')
  async listMaintenance(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<MaintenanceView[]> {
    return this.maintenance.list((await this.status.find(actor, id)).id);
  }

  @Post('maintenance')
  @MinRole('engineer')
  async createMaintenance(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(maintenanceSchema)) body: MaintenanceInput,
  ): Promise<{ id: string }> {
    return this.maintenance.create(await this.status.find(actor, id), body);
  }

  @Put('maintenance/:maintenanceId')
  @MinRole('engineer')
  @HttpCode(204)
  async updateMaintenance(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('maintenanceId', ParseUUIDPipe) maintenanceId: string,
    @Body(new ZodValidationPipe(maintenanceSchema)) body: MaintenanceInput,
  ): Promise<void> {
    await this.maintenance.update(await this.status.find(actor, id), maintenanceId, body);
  }

  @Delete('maintenance/:maintenanceId')
  @MinRole('engineer')
  @HttpCode(204)
  async removeMaintenance(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('maintenanceId', ParseUUIDPipe) maintenanceId: string,
  ): Promise<void> {
    await this.maintenance.remove((await this.status.find(actor, id)).id, maintenanceId);
  }
}
