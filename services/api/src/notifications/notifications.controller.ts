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
  UseGuards,
} from '@nestjs/common';
import {
  createNotificationChannelSchema,
  updateNotificationChannelSchema,
  type CreateNotificationChannelInput,
  type NotificationChannel,
  type NotificationChannelWithSecret,
  type NotificationDelivery,
  type NotificationTestResult,
  type UpdateNotificationChannelInput,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { NotificationsService } from './notifications.service';

/** Notification channels (Phase 8). Everyone can see them; only admins change or test them. */
@Controller('workspaces/:workspaceId/notifications')
@UseGuards(WorkspaceAccessGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('channels')
  list(@Actor() actor: ActorContext): Promise<NotificationChannel[]> {
    return this.svc.list(actor);
  }

  @Post('channels')
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createNotificationChannelSchema))
    body: CreateNotificationChannelInput,
  ): Promise<NotificationChannelWithSecret> {
    return this.svc.create(actor, body);
  }

  @Patch('channels/:channelId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('channelId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateNotificationChannelSchema))
    body: UpdateNotificationChannelInput,
  ): Promise<NotificationChannel> {
    return this.svc.update(actor, id, body);
  }

  @Delete('channels/:channelId')
  @MinRole('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Actor() actor: ActorContext, @Param('channelId', ParseUUIDPipe) id: string) {
    return this.svc.remove(actor, id);
  }

  @Post('channels/:channelId/test')
  @MinRole('admin')
  @HttpCode(200)
  test(
    @Actor() actor: ActorContext,
    @Param('channelId', ParseUUIDPipe) id: string,
  ): Promise<NotificationTestResult> {
    return this.svc.test(actor, id);
  }

  @Get('deliveries')
  @MinRole('admin')
  deliveries(@Actor() actor: ActorContext): Promise<NotificationDelivery[]> {
    return this.svc.deliveries(actor);
  }
}
