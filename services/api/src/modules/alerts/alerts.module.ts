import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AlertRoutesService } from './application/alert-routes.service';
import { AlertSourcesService } from './application/alert-sources.service';
import { HeartbeatsService } from './application/heartbeats.service';
import { AlertReceiptsService } from './application/alert-receipts.service';
import { LogAlertsService } from './application/log-alerts.service';
import { MonitorExecutor } from './application/monitor-executor.service';
import { MonitorRunner } from './application/monitor-runner.service';
import { MonitorStatsService } from './application/monitor-stats.service';
import { MonitorsService } from './application/monitors.service';
import { LogAlertsController } from './log-alerts.controller';
import { MonitorBadgeController, MonitorsController } from './monitors.controller';
import { AlertIntakeController } from './alert-intake.controller';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [
    AlertIntakeController,
    AlertsController,
    MonitorsController,
    MonitorBadgeController,
    LogAlertsController,
  ],
  providers: [
    AlertSourcesService,
    HeartbeatsService,
    AlertReceiptsService,
    AlertRoutesService,
    MonitorsService,
    MonitorExecutor,
    MonitorStatsService,
    LogAlertsService,
    MonitorRunner,
  ],
  exports: [AlertSourcesService],
})
export class AlertsModule {}
