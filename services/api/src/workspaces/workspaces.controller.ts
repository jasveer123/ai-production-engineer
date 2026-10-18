import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
  type Workspace,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WorkspaceAccessGuard } from './workspace-access.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  /** Any signed-in user can create a workspace and becomes its owner. */
  @Post()
  create(
    @Body(new ZodValidationPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
    @Req() req: Request,
  ): Promise<Workspace> {
    return this.workspaces.create(req.auth!.userId, body.name, req.correlationId);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  get(@Actor() actor: ActorContext): Promise<Workspace> {
    return this.workspaces.get(actor);
  }
}
