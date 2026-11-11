import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AlertRoutesService } from './application/alert-routes.service';
import { AlertSourcesService } from './application/alert-sources.service';
import { MonitorRunner } from './application/monitor-runner.service';
import { MonitorsService } from './application/monitors.service';
import { MonitorsController } from './monitors.controller';
import { AlertIntakeController, AlertsController } from './alerts.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [AlertIntakeController, AlertsController, MonitorsController],
  providers: [AlertSourcesService, AlertRoutesService, MonitorsService, MonitorRunner],
  exports: [AlertSourcesService],
})
export class AlertsModule {}
