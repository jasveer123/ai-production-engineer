import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

/** Ways 6 and 7: alerts from, and read-only log access to, the tools a team already uses. */
@Module({
  imports: [WorkspacesModule, AlertsModule],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
