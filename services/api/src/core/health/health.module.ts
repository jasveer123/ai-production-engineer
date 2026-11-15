import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../../modules/workspaces/workspaces.module';
import { HealthController, SystemStatusController } from './health.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [HealthController, SystemStatusController],
  providers: [ReadinessService],
})
export class HealthModule {}
