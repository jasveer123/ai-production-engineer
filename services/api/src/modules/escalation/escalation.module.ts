import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OncallModule } from '../oncall/oncall.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EscalationEngine } from './application/escalation-engine.service';
import { EscalationRunner } from './application/escalation-runner.service';
import { RecipientsService } from './application/recipients.service';
import { EscalationService } from './application/escalation.service';
import { EscalationController } from './escalation.controller';

@Module({
  imports: [AuthModule, NotificationsModule, OncallModule, WorkspacesModule],
  controllers: [EscalationController],
  providers: [EscalationService, EscalationEngine, RecipientsService, EscalationRunner],
  exports: [EscalationService, EscalationEngine],
})
export class EscalationModule {}
