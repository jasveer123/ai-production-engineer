import { Module } from '@nestjs/common';
import { AlertsModule } from '../../modules/alerts/alerts.module';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

@Module({
  imports: [WorkspacesModule, AlertsModule],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
