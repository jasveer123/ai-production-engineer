import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createFunnelSchema,
  createRumAppSchema,
  rumRangeSchema,
  sessionQuerySchema,
  type CreateFunnelInput,
  type CreateRumAppInput,
  type FunnelResult,
  type FunnelView,
  type RumAppView,
  type RumEventSummary,
  type RumOverview,
  type RumReplay,
  type RumSessionDetail,
  type RumSessionView,
  type RumUserView,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { RumService } from './application/rum.service';

type Range = ReturnType<typeof rumRangeSchema.parse>;
const range = () => new ZodValidationPipe(rumRangeSchema);

@Controller('workspaces/:workspaceId/rum')
@UseGuards(WorkspaceAccessGuard)
export class RumController {
  constructor(private readonly rum: RumService) {}

  @Get('apps')
  apps(@Actor() actor: ActorContext): Promise<RumAppView[]> {
    return this.rum.listApps(actor);
  }

  @Post('apps')
  @MinRole('admin')
  createApp(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createRumAppSchema)) body: CreateRumAppInput,
  ): Promise<RumAppView> {
    return this.rum.createApp(actor, body);
  }

  @Delete('apps/:appId')
  @MinRole('admin')
  @HttpCode(204)
  removeApp(
    @Actor() actor: ActorContext,
    @Param('appId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.rum.removeApp(actor, id);
  }

  @Get('overview')
  overview(@Actor() actor: ActorContext, @Query(range()) q: Range): Promise<RumOverview> {
    return this.rum.overview(actor, q);
  }

  @Get('sessions')
  sessions(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(sessionQuerySchema))
    q: ReturnType<typeof sessionQuerySchema.parse>,
  ): Promise<RumSessionView[]> {
    return this.rum.sessions(actor, q);
  }

  @Get('sessions/:sessionId')
  session(
    @Actor() actor: ActorContext,
    @Param('sessionId', ParseUUIDPipe) id: string,
  ): Promise<RumSessionDetail> {
    return this.rum.session(actor, id);
  }

  @Get('sessions/:sessionId/replay')
  replay(
    @Actor() actor: ActorContext,
    @Param('sessionId', ParseUUIDPipe) id: string,
  ): Promise<RumReplay> {
    return this.rum.replay(actor, id);
  }

  @Get('users')
  users(@Actor() actor: ActorContext, @Query(range()) q: Range): Promise<RumUserView[]> {
    return this.rum.users(actor, q);
  }

  @Get('events')
  events(@Actor() actor: ActorContext, @Query(range()) q: Range): Promise<RumEventSummary[]> {
    return this.rum.events(actor, q);
  }

  @Get('funnels')
  funnels(@Actor() actor: ActorContext): Promise<FunnelView[]> {
    return this.rum.listFunnels(actor);
  }

  @Post('funnels')
  @MinRole('engineer')
  createFunnel(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createFunnelSchema)) body: CreateFunnelInput,
  ): Promise<FunnelView> {
    return this.rum.createFunnel(actor, body);
  }

  @Get('funnels/:funnelId/result')
  funnelResult(
    @Actor() actor: ActorContext,
    @Param('funnelId', ParseUUIDPipe) id: string,
    @Query(range()) q: Range,
  ): Promise<FunnelResult> {
    return this.rum.funnelResult(actor, id, q.minutes);
  }

  @Delete('funnels/:funnelId')
  @MinRole('engineer')
  @HttpCode(204)
  removeFunnel(
    @Actor() actor: ActorContext,
    @Param('funnelId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.rum.removeFunnel(actor, id);
  }
}
