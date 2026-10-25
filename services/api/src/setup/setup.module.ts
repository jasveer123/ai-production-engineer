import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { CollectorModule } from '../collector/collector.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { OAuthStateService } from './oauth-state.service';
import { SetupController, SetupPublicController } from './setup.controller';
import { SetupService } from './setup.service';

/** One-click setup for every integration (ADR-024). */
@Module({
  imports: [WorkspacesModule, IngestionModule, ToolsModule, CollectorModule, AlertsModule],
  controllers: [SetupController, SetupPublicController],
  providers: [SetupService, OAuthStateService],
})
export class SetupModule {}
