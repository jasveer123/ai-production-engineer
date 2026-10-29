import { Module } from '@nestjs/common';
import { GitHubController } from '../../connectors/github/github.controller';
import { GitHubSelectService } from '../../connectors/github/application/github-select.service';
import { GitHubService } from '../../connectors/github/github.service';
import { DeadLettersService } from '../../connectors/integrations/application/dead-letters.service';
import { IntegrationHealth } from '../../connectors/integrations/application/integration-health.service';
import { IntegrationsController } from '../../connectors/integrations/integrations.controller';
import { IntegrationsService } from '../../connectors/integrations/integrations.service';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { AlertsModule } from '../../modules/alerts/alerts.module';
import { DeployWebhookController } from './deploy-webhook.controller';
import { IngestionProcessor } from './application/ingestion.processor';
import { AlertProcessor } from '../../modules/alerts/application/alert-processor';
import { IngestionWorker } from './application/ingestion.worker';
import { JaegerPoller } from './application/jaeger.poller';

@Module({
  imports: [WorkspacesModule, AlertsModule],
  controllers: [DeployWebhookController, IntegrationsController, GitHubController],
  providers: [
    IngestionProcessor,
    AlertProcessor,
    JaegerPoller,
    IngestionWorker,
    IntegrationsService,
    IntegrationHealth,
    DeadLettersService,
    GitHubService,
    GitHubSelectService,
  ],
  exports: [IngestionProcessor, JaegerPoller, GitHubService],
})
export class IngestionModule {}
