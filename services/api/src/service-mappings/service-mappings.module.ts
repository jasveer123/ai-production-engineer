import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ServiceMappingsController } from './service-mappings.controller';
import { ServiceMappingsService } from './service-mappings.service';

@Module({
  imports: [WorkspacesModule],
  controllers: [ServiceMappingsController],
  providers: [ServiceMappingsService],
})
export class ServiceMappingsModule {}
