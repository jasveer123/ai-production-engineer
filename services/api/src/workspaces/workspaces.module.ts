import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { WorkspaceAccessGuard } from './workspace-access.guard';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [WorkspacesController, MembersController],
  providers: [WorkspacesService, MembersService, WorkspaceAccessGuard],
  exports: [WorkspaceAccessGuard],
})
export class WorkspacesModule {}
