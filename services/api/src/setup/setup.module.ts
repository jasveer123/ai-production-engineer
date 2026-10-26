import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { CollectorModule } from '../collector/collector.module';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { OAuthStateService } from './oauth-state.service';
import { SetupController, SetupPublicController, SetupToolsController } from './setup.controller';
import { AwsSetupService } from './setup-aws.service';
import { GitHubSetupService } from './setup-github.service';
import { OAuthSetupService } from './setup-oauth.service';
import { SetupSupport } from './setup-support.service';
import { ToolSetupService } from './setup-tools.service';
import { SetupService } from './setup.service';

/** One-click setup for every integration (ADR-024). */
@Module({
  imports: [WorkspacesModule, IngestionModule, ToolsModule, CollectorModule, AlertsModule],
  controllers: [SetupController, SetupToolsController, SetupPublicController],
  providers: [
    SetupService,
    SetupSupport,
    GitHubSetupService,
    ToolSetupService,
    OAuthSetupService,
    AwsSetupService,
    OAuthStateService,
  ],
})
export class SetupModule {}
