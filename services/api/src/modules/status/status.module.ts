import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { StatusAutomationService } from './application/status-automation.service';
import { StatusRunner } from './application/status-runner.service';
import { StatusService } from './application/status.service';
import { SubscribersService } from './application/subscribers.service';
import { PublicStatusController, StatusController } from './status.controller';

@Module({
  imports: [WorkspacesModule, AuthModule],
  controllers: [StatusController, PublicStatusController],
  providers: [StatusService, SubscribersService, StatusAutomationService, StatusRunner],
})
export class StatusModule {}
