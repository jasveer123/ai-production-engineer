import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  addSubscriberSchema,
  createStatusPageSchema,
  structureSchema,
  updateStatusPageSchema,
  type AddSubscriberInput,
  type CreateStatusPageInput,
  type NotificationView,
  type StatusPageView,
  type StructureParsed,
  type StructureView,
  type SubscriberView,
  type UpdateStatusPageInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { StatusService } from './application/status.service';
import { StructureService } from './application/structure.service';
import { SubscribersService } from './application/subscribers.service';

@Controller(['workspaces/:workspaceId/status-pages', 'api/v1/workspaces/:workspaceId/status-pages'])
@UseGuards(WorkspaceAccessGuard)
export class StatusController {
  constructor(
    private readonly status: StatusService,
    private readonly structure: StructureService,
    private readonly subscribers: SubscribersService,
  ) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<StatusPageView[]> {
    return this.status.list(actor);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createStatusPageSchema)) body: CreateStatusPageInput,
  ): Promise<StatusPageView> {
    return this.status.create(actor, body);
  }

  @Get(':pageId')
  get(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<StatusPageView> {
    return this.status.get(actor, id);
  }

  @Patch(':pageId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateStatusPageSchema)) body: UpdateStatusPageInput,
  ): Promise<StatusPageView> {
    return this.status.update(actor, id, body);
  }

  @Delete(':pageId')
  @MinRole('admin')
  @HttpCode(204)
  remove(@Actor() actor: ActorContext, @Param('pageId', ParseUUIDPipe) id: string): Promise<void> {
    return this.status.remove(actor, id);
  }

  @Post(':pageId/verify-domain')
  @MinRole('admin')
  @HttpCode(200)
  verifyDomain(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<StatusPageView> {
    return this.status.verifyDomain(actor, id);
  }

  @Get(':pageId/structure')
  async getStructure(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<StructureView> {
    return this.structure.view(await this.status.find(actor, id));
  }

  @Put(':pageId/structure')
  @MinRole('admin')
  async saveStructure(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(structureSchema)) body: StructureParsed,
  ): Promise<StructureView> {
    const page = await this.status.find(actor, id);
    await this.structure.save(page, body);
    return this.structure.view(page);
  }

  @Get(':pageId/subscribers')
  @MinRole('admin')
  async listSubscribers(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<SubscriberView[]> {
    return this.subscribers.list((await this.status.find(actor, id)).id);
  }

  @Get(':pageId/subscribers.csv')
  @MinRole('admin')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="subscribers.csv"')
  async exportSubscribers(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<string> {
    return this.subscribers.csv((await this.status.find(actor, id)).id);
  }

  @Post(':pageId/subscribers')
  @MinRole('admin')
  @HttpCode(202)
  async addSubscriber(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addSubscriberSchema)) body: AddSubscriberInput,
  ): Promise<{ ok: true }> {
    await this.subscribers.enroll(await this.status.find(actor, id), body.email);
    return { ok: true };
  }

  @Delete(':pageId/subscribers/:subscriberId')
  @MinRole('admin')
  @HttpCode(204)
  async removeSubscriber(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
    @Param('subscriberId', ParseUUIDPipe) subscriberId: string,
  ): Promise<void> {
    await this.subscribers.remove((await this.status.find(actor, id)).id, subscriberId);
  }

  @Get(':pageId/notifications')
  async notifications(
    @Actor() actor: ActorContext,
    @Param('pageId', ParseUUIDPipe) id: string,
  ): Promise<NotificationView[]> {
    return this.subscribers.notifications((await this.status.find(actor, id)).id);
  }
}
