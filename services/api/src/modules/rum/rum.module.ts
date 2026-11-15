import { Module } from '@nestjs/common';
import { ErrorsModule } from '../errors/errors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { RumIngestService } from './application/rum-ingest.service';
import { RumFunnelsService } from './application/rum-funnels.service';
import { RumService } from './application/rum.service';
import { RumIngestController } from './rum-ingest.controller';
import { RumController } from './rum.controller';

@Module({
  imports: [WorkspacesModule, ErrorsModule],
  controllers: [RumController, RumIngestController],
  providers: [RumService, RumIngestService, RumFunnelsService],
})
export class RumModule {}
