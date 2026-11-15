import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ErrorAppsService } from './application/error-apps.service';
import { ErrorsService } from './application/errors.service';
import { SentryIngestService } from './application/sentry-ingest.service';
import { SourceMapsService } from './application/source-maps.service';
import { ErrorAppsController, ErrorsController, SourceMapsController } from './errors.controller';
import { WindowLimiter } from './infrastructure/window-limiter';
import { SentryIngestController } from './sentry-ingest.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [
    ErrorsController,
    SourceMapsController,
    ErrorAppsController,
    SentryIngestController,
  ],
  providers: [
    ErrorsService,
    SourceMapsService,
    ErrorAppsService,
    SentryIngestService,
    WindowLimiter,
  ],
  exports: [WindowLimiter],
})
export class ErrorsModule {}
