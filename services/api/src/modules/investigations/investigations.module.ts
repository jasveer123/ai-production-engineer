import { Module } from '@nestjs/common';
import { ArtifactStore } from '../../core/artifacts/artifact-store.service';
import { IngestionModule } from '../../ingest/ingestion/ingestion.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxPublisher } from '../../core/temporal/outbox-publisher.service';
import { TemporalService } from '../../core/temporal/temporal.service';
import { ToolsModule } from '../../connectors/tools/tools.module';
import { UsageModule } from '../usage/usage.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FixActivitiesService } from '../fixes/activities/fix-activities.service';
import { FixPreparer } from '../fixes/application/fix-preparer.service';
import { FixesService } from '../fixes/fixes.service';
import { GitHubWebhookController } from '../pulls/github-webhook.controller';
import { PrActivitiesService } from '../pulls/activities/pr-activities.service';
import { PullSyncService } from '../pulls/application/pull-sync.service';
import { PullsController } from '../pulls/pulls.controller';
import { PullsService } from '../pulls/pulls.service';
import { EvidenceCollector } from './application/evidence-collector.service';
import { InvestigationActivities } from './activities/investigation-activities.service';
import { FixesController } from '../fixes/fixes.controller';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { VerificationController } from '../verification/verification.controller';
import { VerificationService } from '../verification/verification.service';
import { VerificationMetrics } from '../verification/application/verification-metrics.service';
import { VerifyActivitiesService } from '../verification/activities/verify-activities.service';

@Module({
  imports: [WorkspacesModule, IngestionModule, NotificationsModule, ToolsModule, UsageModule],
  controllers: [
    InvestigationsController,
    FixesController,
    GitHubWebhookController,
    PullsController,
    VerificationController,
  ],
  providers: [
    ArtifactStore,
    TemporalService,
    OutboxPublisher,
    EvidenceCollector,
    InvestigationActivities,
    InvestigationsService,
    FixActivitiesService,
    FixPreparer,
    FixesService,
    PrActivitiesService,
    PullSyncService,
    PullsService,
    VerificationService,
    VerificationMetrics,
    VerifyActivitiesService,
  ],
  exports: [
    InvestigationActivities,
    TemporalService,
    OutboxPublisher,
    FixActivitiesService,
    PrActivitiesService,
    PullSyncService,
    PullsService,
    VerifyActivitiesService,
  ],
})
export class InvestigationsModule {}
