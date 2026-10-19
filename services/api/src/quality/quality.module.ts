import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [QualityController],
  providers: [QualityService],
})
export class QualityModule {}
