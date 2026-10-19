import { Module } from '@nestjs/common';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OutboxPublisher } from '../temporal/outbox-publisher.service';
import { TemporalService } from '../temporal/temporal.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FixActivitiesService } from '../fixes/fix-activities.service';
import { FixesService } from '../fixes/fixes.service';
import { GitHubWebhookController } from '../pulls/github-webhook.controller';
import { PrActivitiesService } from '../pulls/pr-activities.service';
import { PullSyncService } from '../pulls/pull-sync.service';
import { PullsController } from '../pulls/pulls.controller';
import { PullsService } from '../pulls/pulls.service';
import { EvidenceCollector } from './evidence-collector.service';
import { InvestigationActivities } from './investigation-activities.service';
import { FixesController } from '../fixes/fixes.controller';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';
import { VerificationController } from '../verification/verification.controller';
import { VerificationService } from '../verification/verification.service';
import { VerifyActivitiesService } from '../verification/verify-activities.service';

@Module({
  imports: [WorkspacesModule, IngestionModule, NotificationsModule],
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
    FixesService,
    PrActivitiesService,
    PullSyncService,
    PullsService,
    VerificationService,
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
