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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createContactMethodSchema,
  createNotificationChannelSchema,
  deliveryQuerySchema,
  updateNotificationChannelSchema,
  type ContactMethodView,
  type CreateContactMethodInput,
  type CreateNotificationChannelInput,
  type DeliveryAttemptView,
  type DeliveryQuery,
  type NotificationChannel,
  type NotificationChannelWithSecret,
  type NotificationProviders,
  type NotificationTestResult,
  type UpdateNotificationChannelInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { ContactMethodsService } from './application/contact-methods.service';
import { DeliveryLog } from './application/delivery-log.service';
import { NotificationSender } from './infrastructure/notification-sender.service';
import { NotificationsService } from './notifications.service';

@Controller('workspaces/:workspaceId/notifications')
@UseGuards(WorkspaceAccessGuard)
export class NotificationsController {
  constructor(
    private readonly svc: NotificationsService,
    private readonly log: DeliveryLog,
    private readonly contacts: ContactMethodsService,
    private readonly sender: NotificationSender,
  ) {}

  @Get('providers')
  providers(): NotificationProviders {
    return { email: this.sender.emailConfigured, twilio: this.sender.twilioConfigured };
  }

  @Get('incidents/:incidentId')
  forIncident(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
  ): Promise<DeliveryAttemptView[]> {
    return this.log.forIncident(actor.workspaceId, incidentId);
  }

  @Get('contact-methods')
  contactMethods(@Actor() actor: ActorContext): Promise<ContactMethodView[]> {
    return this.contacts.list(actor);
  }

  @Post('contact-methods')
  @MinRole('engineer')
  addContactMethod(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createContactMethodSchema)) body: CreateContactMethodInput,
  ): Promise<ContactMethodView> {
    return this.contacts.create(actor, body);
  }

  @Delete('contact-methods/:methodId')
  @MinRole('engineer')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContactMethod(
    @Actor() actor: ActorContext,
    @Param('methodId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.contacts.remove(actor, id);
  }

  @Post('contact-methods/:methodId/test')
  @MinRole('engineer')
  @HttpCode(200)
  testContactMethod(
    @Actor() actor: ActorContext,
    @Param('methodId', ParseUUIDPipe) id: string,
  ): Promise<NotificationTestResult> {
    return this.contacts.test(actor, id);
  }

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
  deliveries(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(deliveryQuerySchema)) query: DeliveryQuery,
  ): Promise<DeliveryAttemptView[]> {
    return this.log.list(actor.workspaceId, query);
  }
}
