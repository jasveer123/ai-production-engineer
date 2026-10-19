import { Module } from '@nestjs/common';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { IngestionModule } from '../ingestion/ingestion.module';
import { OutboxPublisher } from '../temporal/outbox-publisher.service';
import { TemporalService } from '../temporal/temporal.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EvidenceCollector } from './evidence-collector.service';
import { InvestigationActivities } from './investigation-activities.service';
import { InvestigationsController } from './investigations.controller';
import { InvestigationsService } from './investigations.service';

@Module({
  imports: [WorkspacesModule, IngestionModule],
  controllers: [InvestigationsController],
  providers: [
    ArtifactStore,
    TemporalService,
    OutboxPublisher,
    EvidenceCollector,
    InvestigationActivities,
    InvestigationsService,
  ],
  exports: [InvestigationActivities, TemporalService, OutboxPublisher],
})
export class InvestigationsModule {}
