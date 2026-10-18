import { Module } from '@nestjs/common';
import { GitHubController } from '../github/github.controller';
import { GitHubService } from '../github/github.service';
import { IntegrationsController } from '../integrations/integrations.controller';
import { IntegrationsService } from '../integrations/integrations.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DeployWebhookController } from './deploy-webhook.controller';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionWorker } from './ingestion.worker';
import { JaegerPoller } from './jaeger.poller';

@Module({
  imports: [WorkspacesModule],
  controllers: [DeployWebhookController, IntegrationsController, GitHubController],
  providers: [
    IngestionProcessor,
    JaegerPoller,
    IngestionWorker,
    IntegrationsService,
    GitHubService,
  ],
  exports: [IngestionProcessor, JaegerPoller, GitHubService],
})
export class IngestionModule {}
