import { Module } from '@nestjs/common';
import { OncallModule } from '../oncall/oncall.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AssistantService } from './application/assistant.service';
import { WorkspaceContext } from './application/workspace-context';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [WorkspacesModule, OncallModule],
  controllers: [AssistantController],
  providers: [AssistantService, WorkspaceContext],
})
export class AssistantModule {}
