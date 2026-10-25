import { Module } from '@nestjs/common';
import { GitHubController } from '../github/github.controller';
import { GitHubSelectService } from '../github/github-select.service';
import { GitHubService } from '../github/github.service';
import { IntegrationsController } from '../integrations/integrations.controller';
import { IntegrationsService } from '../integrations/integrations.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AlertsModule } from '../alerts/alerts.module';
import { DeployWebhookController } from './deploy-webhook.controller';
import { IngestionProcessor } from './ingestion.processor';
import { AlertProcessor } from '../alerts/alert-processor';
import { IngestionWorker } from './ingestion.worker';
import { JaegerPoller } from './jaeger.poller';

@Module({
  imports: [WorkspacesModule, AlertsModule],
  controllers: [DeployWebhookController, IntegrationsController, GitHubController],
  providers: [
    IngestionProcessor,
    AlertProcessor,
    JaegerPoller,
    IngestionWorker,
    IntegrationsService,
    GitHubService,
    GitHubSelectService,
  ],
  exports: [IngestionProcessor, JaegerPoller, GitHubService],
})
export class IngestionModule {}
