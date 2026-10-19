import { Module } from '@nestjs/common';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { OutboxPublisher } from '../temporal/outbox-publisher.service';
import { TemporalService } from '../temporal/temporal.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { FixActivitiesService } from '../fixes/fix-activities.service';
import { FixesService } from '../fixes/fixes.service';
import { EvidenceCollector } from './evidence-collector.service';
import { InvestigationActivities } from './investigation-activities.service';
import { FixesController } from '../fixes/fixes.controller';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';

@Module({
  imports: [WorkspacesModule, IngestionModule],
  controllers: [InvestigationsController, FixesController],
  providers: [
    ArtifactStore,
    TemporalService,
    OutboxPublisher,
    EvidenceCollector,
    InvestigationActivities,
    InvestigationsService,
    FixActivitiesService,
    FixesService,
  ],
  exports: [InvestigationActivities, TemporalService, OutboxPublisher, FixActivitiesService],
})
export class InvestigationsModule {}
