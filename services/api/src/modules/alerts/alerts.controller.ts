import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  alertListQuerySchema,
  alertPreviewSchema,
  alertRouteSchema,
  createAlertSourceSchema,
  updateAlertSourceSchema,
  reorderAlertRoutesSchema,
  updateAlertRouteSchema,
  type AlertListQuery,
  type AlertIntakeReceipt,
  type AlertPreview,
  type AlertReceiptView,
  type AlertRoute,
  type AlertRouteInput,
  type AlertSource,
  type AlertSourceWithToken,
  type AlertView,
  type CreateAlertSourceInput,
  type HeartbeatDetail,
  type UpdateAlertSourceInput,
} from '@ape/api-contracts';
import type { Request } from 'express';
import { Actor } from '../../core/common/actor.decorator';
import { ApiException, notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { AlertReceiptsService } from './application/alert-receipts.service';
import { AlertRoutesService } from './application/alert-routes.service';
import { AlertSourcesService, type SourceConfig } from './application/alert-sources.service';
import { HeartbeatsService } from './application/heartbeats.service';
import type { HeartbeatSignal } from './domain/heartbeat';
import { bodyText, eventIdOf, executionIdOf, validationProblem } from './intake-helpers';

@Controller(['workspaces/:workspaceId', 'api/v1/workspaces/:workspaceId'])
@UseGuards(WorkspaceAccessGuard)
export class AlertsController {
  constructor(
    private readonly sources: AlertSourcesService,
    private readonly routes: AlertRoutesService,
    private readonly heartbeats: HeartbeatsService,
    private readonly receipts: AlertReceiptsService,
  ) {}

  @Post('alert-sources/:sourceId/events')
  @MinRole('engineer')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendEvent(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AlertIntakeReceipt> {
    const row = await this.sources.find(actor, id);
    const kind = (row.config as unknown as SourceConfig).kind;
    if (
      kind === 'heartbeat' ||
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    )
      throw new ApiException(HttpStatus.BAD_REQUEST, 'validation_failed', 'Expected a JSON alert');
    const body = req.body as Record<string, unknown>;
    const problem = validationProblem(kind, body);
    const receipt = await this.sources.receive(
      row,
      eventIdOf(req, body),
      body,
      problem ?? undefined,
    );
    if (problem)
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_payload', problem, receipt);
    return { accepted: true, ...receipt };
  }

  @Post('alert-sources/:sourceId/heartbeat/ping')
  @MinRole('engineer')
  @HttpCode(HttpStatus.ACCEPTED)
  async ping(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Query('signal') signal: string | undefined,
    @Req() req: Request,
  ) {
    const row = await this.sources.find(actor, id);
    if ((row.config as unknown as SourceConfig).kind !== 'heartbeat') throw notFound('Heartbeat');
    const kind: HeartbeatSignal = signal === 'fail' || signal === 'start' ? signal : 'success';
    const result = await this.heartbeats.signal(row.id, {
      signal: kind,
      at: new Date(),
      executionId: executionIdOf(req),
      cause: kind === 'fail' ? bodyText(req) : null,
    });
    return { accepted: true, ...result };
  }

  @Get('alerts')
  alerts(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(alertListQuerySchema)) q: AlertListQuery & { limit: number },
  ): Promise<AlertView[]> {
    return this.routes.alerts(actor, q);
  }

  @Get('alert-sources')
  listSources(@Actor() actor: ActorContext): Promise<AlertSource[]> {
    return this.sources.list(actor);
  }

  @Post('alert-sources')
  @MinRole('admin')
  createSource(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createAlertSourceSchema)) body: CreateAlertSourceInput,
  ): Promise<AlertSourceWithToken> {
    return this.sources.create(actor, body);
  }

  @Patch('alert-sources/:sourceId')
  @MinRole('admin')
  updateSource(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAlertSourceSchema)) body: UpdateAlertSourceInput,
  ): Promise<AlertSource> {
    return this.sources.update(actor, id, body);
  }

  @Get('alert-sources/:sourceId/heartbeat')
  heartbeat(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
  ): Promise<HeartbeatDetail> {
    return this.sources.heartbeatDetail(actor, id);
  }

  @Get('alert-sources/:sourceId/events')
  listReceipts(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
  ): Promise<AlertReceiptView[]> {
    return this.receipts.list(actor, id);
  }

  @Post('alert-sources/:sourceId/events/:receiptId/replay')
  @MinRole('admin')
  @HttpCode(200)
  replay(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
  ): Promise<AlertReceiptView> {
    return this.receipts.replay(actor, id, receiptId);
  }

  @Post('alert-sources/:sourceId/rotate-token')
  @MinRole('admin')
  @HttpCode(200)
  rotate(
    @Actor() actor: ActorContext,
    @Param('sourceId', ParseUUIDPipe) id: string,
  ): Promise<AlertSourceWithToken> {
    return this.sources.rotate(actor, id);
  }

  @Delete('alert-sources/:sourceId')
  @MinRole('admin')
  @HttpCode(204)
  removeSource(@Actor() actor: ActorContext, @Param('sourceId', ParseUUIDPipe) id: string) {
    return this.sources.remove(actor, id);
  }

  @Get('alert-routes')
  listRoutes(@Actor() actor: ActorContext): Promise<AlertRoute[]> {
    return this.routes.list(actor);
  }

  @Post('alert-routes')
  @MinRole('admin')
  createRoute(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(alertRouteSchema)) body: AlertRouteInput,
  ): Promise<AlertRoute> {
    return this.routes.create(actor, body);
  }

  @Put('alert-routes/order')
  @MinRole('admin')
  reorder(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(reorderAlertRoutesSchema)) body: { ids: string[] },
  ): Promise<AlertRoute[]> {
    return this.routes.reorder(actor, body.ids);
  }

  @Post('alert-routes/preview')
  @MinRole('admin')
  @HttpCode(200)
  preview(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(alertPreviewSchema)) body: { sourceId: string; payload: unknown },
  ): Promise<AlertPreview> {
    return this.routes.preview(actor, body.sourceId, body.payload);
  }

  @Patch('alert-routes/:routeId')
  @MinRole('admin')
  updateRoute(
    @Actor() actor: ActorContext,
    @Param('routeId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAlertRouteSchema)) body: Partial<AlertRouteInput>,
  ): Promise<AlertRoute> {
    return this.routes.update(actor, id, body);
  }

  @Delete('alert-routes/:routeId')
  @MinRole('admin')
  @HttpCode(204)
  removeRoute(@Actor() actor: ActorContext, @Param('routeId', ParseUUIDPipe) id: string) {
    return this.routes.remove(actor, id);
  }
}
