import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  businessImpactQuerySchema,
  serviceValueSchema,
  type BusinessImpact,
  type ServiceValueInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { BusinessService } from './business.service';

@Controller('workspaces/:workspaceId/business')
@UseGuards(WorkspaceAccessGuard)
export class BusinessController {
  constructor(private readonly svc: BusinessService) {}

  @Get('impact')
  impact(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(businessImpactQuerySchema)) q: { days: number },
  ): Promise<BusinessImpact> {
    return this.svc.impact(actor, q.days);
  }

  @Put('services/:serviceId/value')
  @MinRole('admin')
  @HttpCode(204)
  setValue(
    @Actor() actor: ActorContext,
    @Param('serviceId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(serviceValueSchema)) body: ServiceValueInput,
  ): Promise<void> {
    return this.svc.setValue(actor, id, body);
  }
}
