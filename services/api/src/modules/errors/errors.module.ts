import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ErrorsService } from './application/errors.service';
import { SourceMapsService } from './application/source-maps.service';
import { ErrorsController, SourceMapsController } from './errors.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [ErrorsController, SourceMapsController],
  providers: [ErrorsService, SourceMapsService],
})
export class ErrorsModule {}
