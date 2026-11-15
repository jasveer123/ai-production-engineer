import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MaintenanceService } from './application/maintenance.service';
import { PublicStatusService } from './application/public-status.service';
import { ReportsService } from './application/reports.service';
import { StatusAutomationService } from './application/status-automation.service';
import { StatusOutbox } from './application/status-outbox.service';
import { StatusRunner } from './application/status-runner.service';
import { StatusService } from './application/status.service';
import { StructureService } from './application/structure.service';
import { SubscribersService } from './application/subscribers.service';
import { PublicStatusController } from './public-status.controller';
import { StatusReportsController } from './status-reports.controller';
import { StatusController } from './status.controller';

@Module({
  imports: [WorkspacesModule, AuthModule],
  controllers: [StatusController, StatusReportsController, PublicStatusController],
  providers: [
    StatusService,
    StructureService,
    SubscribersService,
    ReportsService,
    MaintenanceService,
    PublicStatusService,
    StatusOutbox,
    StatusAutomationService,
    StatusRunner,
  ],
})
export class StatusModule {}
