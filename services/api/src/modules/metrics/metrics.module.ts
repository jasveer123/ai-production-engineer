import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { MetricsService } from './application/metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
