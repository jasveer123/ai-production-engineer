import { createHash } from 'node:crypto';
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
  reorderAlertRoutesSchema,
  updateAlertRouteSchema,
  type AlertListQuery,
  type AlertPreview,
  type AlertRoute,
  type AlertRouteInput,
  type AlertSource,
  type AlertSourceWithToken,
  type AlertView,
  type CreateAlertSourceInput,
} from '@ape/api-contracts';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { Public } from '../auth/public.decorator';
import { Actor } from '../common/actor.decorator';
import { ApiException } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { AlertRoutesService } from './alert-routes.service';
import { AlertSourcesService, type SourceConfig } from './alert-sources.service';

/** Token from `Authorization: Bearer`, `X-Ape-Token`, or `?token=` (for tools without headers). */
function tokenOf(req: Request): string | undefined {
  const auth = req.header('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return (
    req.header('x-ape-token') ?? (typeof req.query.token === 'string' ? req.query.token : undefined)
  );
}

/** SNS posts JSON with `Content-Type: text/plain`; the text parser leaves it as a string. */
function parseSnsBody(req: Request): Record<string, unknown> | null {
  const body: unknown = req.body;
  if (body && typeof body === 'object' && !Array.isArray(body) && 'Type' in body) return body;
  if (typeof body !== 'string') return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const unauthorized = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, 'invalid_token', 'Unknown alert source or bad token');

/** Public intake. Authentication is the per-source token; processing is asynchronous. */
@Controller('ingest')
export class AlertIntakeController {
  constructor(
    private readonly sources: AlertSourcesService,
    private readonly audit: AuditService,
  ) {}

  private async reject(sourceId: string, req: Request) {
    await this.audit.record({
      actorType: 'system',
      action: 'alert_source.rejected',
      resourceType: 'alert_source',
      resourceId: sourceId.slice(0, 64),
      outcome: 'denied',
      correlationId: req.correlationId,
      metadata: { ip: req.ip },
    });
    return unauthorized();
  }

  @Public()
  @Post('alerts/:sourceId')
  @HttpCode(HttpStatus.ACCEPTED)
  async alert(@Param('sourceId') sourceId: string, @Req() req: Request) {
    const row = await this.sources.authenticate(sourceId, tokenOf(req));
    if (!row) throw await this.reject(sourceId, req);
    if ((row.config as unknown as SourceConfig).kind === 'heartbeat') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'heartbeat',
        'Send heartbeats to /ingest/heartbeats',
      );
    }
    if ((row.config as unknown as SourceConfig).kind === 'cloudwatch') {
      const sns = parseSnsBody(req);
      if (sns?.Type === 'SubscriptionConfirmation' || sns?.Type === 'UnsubscribeConfirmation') {
        await this.sources.confirmSnsSubscription(row, sns);
        return { accepted: true, duplicate: false };
      }
      if (sns) req.body = sns;
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'validation_failed', 'Expected a JSON object');
    }
    // A retried identical body maps to the same inbound event.
    const id = createHash('sha256')
      .update(req.rawBody ?? JSON.stringify(req.body))
      .digest('hex');
    const duplicate = await this.sources.buffer(row, id, req.body as Record<string, unknown>);
    return { accepted: true, duplicate };
  }

  /** Heartbeat ping. GET works too, for curl in cron jobs and simple uptime tools. */
  @Public()
  @Post('heartbeats/:sourceId')
  @HttpCode(HttpStatus.ACCEPTED)
  async pingPost(@Param('sourceId') sourceId: string, @Req() req: Request) {
    return this.ping(sourceId, req);
  }

  @Public()
  @Get('heartbeats/:sourceId')
  @HttpCode(HttpStatus.ACCEPTED)
  async pingGet(@Param('sourceId') sourceId: string, @Req() req: Request) {
    return this.ping(sourceId, req);
  }

  private async ping(sourceId: string, req: Request) {
    const row = await this.sources.authenticate(sourceId, tokenOf(req));
    if (!row || (row.config as unknown as SourceConfig).kind !== 'heartbeat')
      throw await this.reject(sourceId, req);
    return { accepted: true, state: await this.sources.ping(row) };
  }
}

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class AlertsController {
  constructor(
    private readonly sources: AlertSourcesService,
    private readonly routes: AlertRoutesService,
  ) {}

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
