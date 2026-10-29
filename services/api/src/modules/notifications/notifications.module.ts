import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationDispatcher } from './application/notification-dispatcher.service';
import { NotificationSender } from './infrastructure/notification-sender.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSender, NotificationDispatcher],
  exports: [NotificationDispatcher],
})
export class NotificationsModule {}
