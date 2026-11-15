import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ContactMethodsService } from './application/contact-methods.service';
import { DeliveryLedger } from './application/delivery-ledger.service';
import { DeliveryLog } from './application/delivery-log.service';
import { NotificationDispatcher } from './application/notification-dispatcher.service';
import { NotificationSender } from './infrastructure/notification-sender.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TwilioCallbackController } from './twilio-callback.controller';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [NotificationsController, TwilioCallbackController],
  providers: [
    NotificationsService,
    NotificationSender,
    NotificationDispatcher,
    DeliveryLedger,
    DeliveryLog,
    ContactMethodsService,
  ],
  exports: [NotificationDispatcher, DeliveryLedger, DeliveryLog, ContactMethodsService],
})
export class NotificationsModule {}
