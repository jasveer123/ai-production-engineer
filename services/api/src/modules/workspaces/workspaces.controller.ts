import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type Workspace,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from './min-role.decorator';
import { WorkspaceAccessGuard } from './workspace-access.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
    @Req() req: Request,
  ): Promise<Workspace> {
    return this.workspaces.create(req.auth!.userId, body.name, req.correlationId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  @MinRole('admin')
  rename(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(updateWorkspaceSchema)) body: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    return this.workspaces.rename(actor, body.name);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  get(@Actor() actor: ActorContext): Promise<Workspace> {
    return this.workspaces.get(actor);
  }
}
