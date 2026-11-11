import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RumIngestService } from './application/rum-ingest.service';
import { RumService } from './application/rum.service';
import { RumIngestController } from './rum-ingest.controller';
import { RumController } from './rum.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [RumController, RumIngestController],
  providers: [RumService, RumIngestService],
})
export class RumModule {}
