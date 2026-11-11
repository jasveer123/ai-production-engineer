import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { OncallService } from './application/oncall.service';
import { OncallController } from './oncall.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [OncallController],
  providers: [OncallService],
  exports: [OncallService],
})
export class OncallModule {}
