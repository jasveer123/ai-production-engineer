import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AlertRoutesService } from './application/alert-routes.service';
import { AlertSourcesService } from './application/alert-sources.service';
import { AlertIntakeController, AlertsController } from './alerts.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [AlertIntakeController, AlertsController],
  providers: [AlertSourcesService, AlertRoutesService],
  exports: [AlertSourcesService],
})
export class AlertsModule {}
