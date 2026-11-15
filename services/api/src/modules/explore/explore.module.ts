import { Module } from '@nestjs/common';
import { CollectorModule } from '../../ingest/collector/collector.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { LogsExplorerService } from './application/logs-explorer.service';
import { SavedQueriesService } from './application/saved-queries.service';
import { ServiceMapService } from './application/service-map.service';
import { SourcesService } from './application/sources.service';
import { TracesExplorerService } from './application/traces-explorer.service';
import { ExploreController } from './explore.controller';

@Module({
  imports: [WorkspacesModule, CollectorModule],
  controllers: [ExploreController],
  providers: [
    LogsExplorerService,
    TracesExplorerService,
    ServiceMapService,
    SavedQueriesService,
    SourcesService,
  ],
})
export class ExploreModule {}
