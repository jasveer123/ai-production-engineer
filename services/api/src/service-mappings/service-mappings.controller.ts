import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createServiceSchema,
  updateServiceSchema,
  type CreateServiceInput,
  type DiscoveredService,
  type Service,
  type UpdateServiceInput,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { ServiceMappingsService } from './service-mappings.service';

@Controller('workspaces/:workspaceId/services')
@UseGuards(WorkspaceAccessGuard)
export class ServiceMappingsController {
  constructor(private readonly svc: ServiceMappingsService) {}

  @Get()
  list(@Actor() actor: ActorContext): Promise<Service[]> {
    return this.svc.list(actor);
  }

  // Declared before ':serviceId' so the UUID pipe never sees "discovered".
  @Get('discovered')
  discovered(@Actor() actor: ActorContext): Promise<DiscoveredService[]> {
    return this.svc.discovered(actor);
  }

  @Get(':serviceId')
  get(
    @Actor() actor: ActorContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
  ): Promise<Service> {
    return this.svc.get(actor, id);
  }

  @Post()
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceInput,
  ): Promise<Service> {
    return this.svc.create(actor, body);
  }

  @Patch(':serviceId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ): Promise<Service> {
    return this.svc.update(actor, id, body);
  }

  @Delete(':serviceId')
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.svc.remove(actor, id);
  }
}
