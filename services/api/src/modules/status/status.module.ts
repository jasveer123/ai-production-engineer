import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { StatusService } from './application/status.service';
import { PublicStatusController, StatusController } from './status.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [StatusController, PublicStatusController],
  providers: [StatusService],
})
export class StatusModule {}
