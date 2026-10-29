import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
