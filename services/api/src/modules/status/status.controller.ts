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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createStatusPageSchema,
  postUpdateSchema,
  subscribeSchema,
  updateStatusPageSchema,
  type CreateStatusPageInput,
  type PostUpdateInput,
  type SubscribeInput,
  type PublicStatus,
  type StatusPageView,
  type UpdateStatusPageInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { Public } from '../auth/public.decorator';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { StatusService } from './application/status.service';
import { SubscribersService } from './application/subscribers.service';

@Controller('workspaces/:workspaceId/status-pages')
@UseGuards(WorkspaceAccessGuard)
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<StatusPageView[]> {
    return this.status.list(actor);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createStatusPageSchema)) body: CreateStatusPageInput,
  ): Promise<StatusPageView> {
    return this.status.create(actor, body);
  }

  @Patch(':pageId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStatusPageSchema)) body: UpdateStatusPageInput,
  ): Promise<StatusPageView> {
    return this.status.update(actor, id, body);
  }

  @Delete(':pageId')
  @MinRole('admin')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('pageId', ParseUUIDPipe) id: string): Promise<void> {
    return this.status.remove(actor, id);
  }

  @Post(':pageId/updates')
  @MinRole('engineer')
  @HttpCode(200)
  postUpdate(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(postUpdateSchema)) body: PostUpdateInput,
  ): Promise<StatusPageView> {
    return this.status.postUpdate(actor, id, body);
  }

  @Post(':pageId/verify-domain')
  @MinRole('admin')
  @HttpCode(200)
  verifyDomain(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<StatusPageView> {
    return this.status.verifyDomain(actor, id);
  }

  @Delete(':pageId/updates/:updateId')
  @MinRole('engineer')
  @HttpCode(204)
  removeUpdate(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('updateId', ParseUUIDPipe) updateId: string,
  ): Promise<void> {
    return this.status.removeUpdate(actor, id, updateId);
  }
}

@Controller('public/status')
export class PublicStatusController {
  constructor(
    private readonly status: StatusService,
    private readonly subscribers: SubscribersService,
  ) {}

  @Public()
  @Get('domain/:host')
  byDomain(@Param('host') host: string): Promise<PublicStatus> {
    return this.status.publicByDomain(host);
  }

  @Public()
  @Get('subscriptions/confirm')
  confirm(@Query('token') token: string): Promise<{ page: string }> {
    return this.subscribers.confirm(token ?? '');
  }

  @Public()
  @Get('subscriptions/unsubscribe')
  unsubscribe(@Query('token') token: string): Promise<{ page: string }> {
    return this.subscribers.unsubscribe(token ?? '');
  }

  @Public()
  @Post(':slug/subscribe')
  @HttpCode(202)
  async subscribe(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(subscribeSchema)) body: SubscribeInput,
  ): Promise<{ ok: true }> {
    await this.subscribers.subscribe(slug.toLowerCase(), body.email);
    return { ok: true };
  }

  @Public()
  @Get(':slug')
  view(@Param('slug') slug: string): Promise<PublicStatus> {
    return this.status.publicView(slug.toLowerCase());
  }
}
