import { Module } from '@nestjs/common';
import { AlertsModule } from '../../modules/alerts/alerts.module';
import { CollectorModule } from '../../ingest/collector/collector.module';
import { IngestionModule } from '../../ingest/ingestion/ingestion.module';
import { ToolsModule } from '../tools/tools.module';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { OAuthStateService } from './application/oauth-state.service';
import { SetupController, SetupPublicController, SetupToolsController } from './setup.controller';
import { AwsSetupService } from './application/setup-aws.service';
import { GitHubSetupService } from './application/setup-github.service';
import { OAuthSetupService } from './application/setup-oauth.service';
import { SetupSupport } from './application/setup-support.service';
import { ToolSetupService } from './application/setup-tools.service';
import { SetupService } from './setup.service';

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
