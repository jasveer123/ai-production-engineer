import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CollectorController } from './collector.controller';
import { IngestTokensService } from './ingest-tokens.service';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { SyslogServer } from './syslog.server';
import { TelemetryStore } from './telemetry-store.service';

/** Telemetry intake (Ways 1-5), ingest tokens, log search and stored traces. */
@Module({
  imports: [WorkspacesModule],
  controllers: [CollectorController, IngestController],
  providers: [IngestTokensService, TelemetryStore, SyslogServer, IngestService],
  exports: [IngestService, TelemetryStore, IngestTokensService, SyslogServer],
})
export class CollectorModule {}
