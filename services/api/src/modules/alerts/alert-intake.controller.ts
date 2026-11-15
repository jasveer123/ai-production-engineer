import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { AlertIntakeReceipt } from '@ape/api-contracts';
import type { Request } from 'express';
import { AuditService } from '../../core/audit/audit.service';
import { ApiException } from '../../core/common/errors';
import { Public } from '../auth/public.decorator';
import { AlertSourcesService, type SourceConfig } from './application/alert-sources.service';
import { HeartbeatsService } from './application/heartbeats.service';
import type { HeartbeatSignal } from './domain/heartbeat';
import {
  bodyText,
  eventIdOf,
  executionIdOf,
  parseSnsBody,
  SIGNALS,
  tokenOf,
  unauthorized,
  validationProblem,
} from './intake-helpers';

@Controller('ingest')
export class AlertIntakeController {
  constructor(
    private readonly sources: AlertSourcesService,
    private readonly heartbeats: HeartbeatsService,
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
  async alert(
    @Param('sourceId') sourceId: string,
    @Req() req: Request,
  ): Promise<AlertIntakeReceipt> {
    const row = await this.sources.authenticate(sourceId, tokenOf(req));
    if (!row) throw await this.reject(sourceId, req);
    const kind = (row.config as unknown as SourceConfig).kind;
    if (kind === 'heartbeat') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'heartbeat',
        'Send heartbeats to /ingest/heartbeats',
      );
    }
    if (kind === 'cloudwatch') {
      const sns = parseSnsBody(req);
      if (sns?.Type === 'SubscriptionConfirmation' || sns?.Type === 'UnsubscribeConfirmation') {
        await this.sources.confirmSnsSubscription(row, sns);
        return { accepted: true, receiptId: null, duplicate: false };
      }
      if (sns) req.body = sns;
    }
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'validation_failed', 'Expected a JSON object');
    }
    const body = req.body as Record<string, unknown>;
    const problem = validationProblem(kind, body);
    const receipt = await this.sources.receive(
      row,
      eventIdOf(req, body),
      body,
      problem ?? undefined,
    );
    if (problem)
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_payload', problem, {
        receiptId: receipt.receiptId,
      });
    return { accepted: true, ...receipt };
  }

  @Public()
  @Post('heartbeats/:sourceId')
  @HttpCode(HttpStatus.ACCEPTED)
  pingPost(@Param('sourceId') sourceId: string, @Req() req: Request) {
    return this.ping(sourceId, tokenOf(req), 'success', req);
  }

  @Public()
  @Get('heartbeats/:sourceId')
  @HttpCode(HttpStatus.ACCEPTED)
  pingGet(@Param('sourceId') sourceId: string, @Req() req: Request) {
    return this.ping(sourceId, tokenOf(req), 'success', req);
  }

  @Public()
  @Post('heartbeats/:sourceId/:token')
  @HttpCode(HttpStatus.ACCEPTED)
  tokenPost(@Param('sourceId') id: string, @Param('token') token: string, @Req() req: Request) {
    return this.byPath(id, token, req);
  }

  @Public()
  @Get('heartbeats/:sourceId/:token')
  @HttpCode(HttpStatus.ACCEPTED)
  tokenGet(@Param('sourceId') id: string, @Param('token') token: string, @Req() req: Request) {
    return this.byPath(id, token, req);
  }

  @Public()
  @Post('heartbeats/:sourceId/:token/:signal')
  @HttpCode(HttpStatus.ACCEPTED)
  signalPost(@Param() p: Record<string, string>, @Req() req: Request) {
    return this.withSignal(p, req);
  }

  @Public()
  @Get('heartbeats/:sourceId/:token/:signal')
  @HttpCode(HttpStatus.ACCEPTED)
  signalGet(@Param() p: Record<string, string>, @Req() req: Request) {
    return this.withSignal(p, req);
  }

  private byPath(sourceId: string, token: string, req: Request) {
    const signal = token as HeartbeatSignal;
    return SIGNALS.has(signal)
      ? this.ping(sourceId, tokenOf(req), signal, req)
      : this.ping(sourceId, token, 'success', req);
  }

  private withSignal(p: Record<string, string>, req: Request) {
    const signal = p.signal as HeartbeatSignal;
    if (!SIGNALS.has(signal))
      throw new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'Use /fail or /start');
    return this.ping(p.sourceId!, p.token, signal, req);
  }

  private async ping(
    sourceId: string,
    token: string | undefined,
    signal: HeartbeatSignal,
    req: Request,
  ) {
    const row = await this.sources.authenticate(sourceId, token);
    if (!row || (row.config as unknown as SourceConfig).kind !== 'heartbeat')
      throw await this.reject(sourceId, req);
    const result = await this.heartbeats.signal(row.id, {
      signal,
      at: new Date(),
      executionId: executionIdOf(req),
      cause: signal === 'fail' ? bodyText(req) : null,
    });
    return { accepted: true, ...result };
  }
}
