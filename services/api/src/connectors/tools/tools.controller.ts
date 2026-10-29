import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  toolAlertsSchema,
  type ToolAlertsEnabled,
  type ToolAlertsInput,
  type ToolId,
  type ToolView,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import { notFound } from '../../core/common/errors';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../../modules/workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { isToolId, ToolsService } from './tools.service';

const tool = (id: string): ToolId => {
  if (!isToolId(id)) throw notFound('Tool');
  return id;
};

@Controller('workspaces/:workspaceId/tools')
@UseGuards(WorkspaceAccessGuard)
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<ToolView[]> {
    return this.tools.list(actor);
  }

  @Put(':tool/alerts')
  @MinRole('admin')
  setAlerts(
    @Actor() actor: ActorContext,
    @Param('tool') id: string,
    @Body(new ZodValidationPipe(toolAlertsSchema)) body: ToolAlertsInput,
  ): Promise<ToolAlertsEnabled> {
    return this.tools.setAlerts(actor, tool(id), body.enabled);
  }

  @Put(':tool/reader')
  @MinRole('admin')
  connect(
    @Actor() actor: ActorContext,
    @Param('tool') id: string,
    @Body() body: unknown,
  ): Promise<ToolView> {
    return this.tools.connectReader(actor, tool(id), body);
  }

  @Post(':tool/reader/test')
  @MinRole('admin')
  @HttpCode(200)
  test(@Actor() actor: ActorContext, @Param('tool') id: string): Promise<ToolView> {
    return this.tools.testReader(actor, tool(id));
  }

  @Delete(':tool/reader')
  @MinRole('admin')
  disconnect(@Actor() actor: ActorContext, @Param('tool') id: string): Promise<ToolView> {
    return this.tools.disconnectReader(actor, tool(id));
  }
}
