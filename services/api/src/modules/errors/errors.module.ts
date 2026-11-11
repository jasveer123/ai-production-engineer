import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ErrorsService } from './application/errors.service';
import { ErrorsController } from './errors.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [ErrorsController],
  providers: [ErrorsService],
})
export class ErrorsModule {}
