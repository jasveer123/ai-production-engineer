import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DeploymentsController } from './deployments.controller';

@Module({ imports: [WorkspacesModule], controllers: [DeploymentsController] })
export class DeploymentsModule {}
