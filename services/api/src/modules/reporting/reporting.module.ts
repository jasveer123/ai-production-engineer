import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ReportingService } from './application/reporting.service';
import { ReportingController } from './reporting.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
