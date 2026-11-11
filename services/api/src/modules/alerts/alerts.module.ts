import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AlertRoutesService } from './application/alert-routes.service';
import { AlertSourcesService } from './application/alert-sources.service';
import { LogAlertsService } from './application/log-alerts.service';
import { MonitorRunner } from './application/monitor-runner.service';
import { MonitorsService } from './application/monitors.service';
import { LogAlertsController } from './log-alerts.controller';
import { MonitorsController } from './monitors.controller';
import { AlertIntakeController, AlertsController } from './alerts.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [AlertIntakeController, AlertsController, MonitorsController, LogAlertsController],
  providers: [
    AlertSourcesService,
    AlertRoutesService,
    MonitorsService,
    LogAlertsService,
    MonitorRunner,
  ],
  exports: [AlertSourcesService],
})
export class AlertsModule {}
