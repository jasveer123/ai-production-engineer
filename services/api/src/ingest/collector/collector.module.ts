import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { CollectorController } from './collector.controller';
import { IngestTokensService } from './application/ingest-tokens.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './application/ingest.service';
import { SyslogServer } from './infrastructure/syslog.server';
import { TelemetryStore } from './application/telemetry-store.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [CollectorController, IngestController],
  providers: [IngestTokensService, TelemetryStore, SyslogServer, IngestService],
  exports: [IngestService, TelemetryStore, IngestTokensService, SyslogServer],
})
export class CollectorModule {}
