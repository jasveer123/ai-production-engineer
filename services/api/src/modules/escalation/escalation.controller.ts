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
  createPolicySchema,
  simplePolicySchema,
  updatePolicySchema,
  type CreatePolicyInput,
  type EscalationRunView,
  type PolicyPreview,
  type PolicyView,
  type SimplePolicyInput,
  type UpdatePolicyInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { EscalationService } from './application/escalation.service';

@Controller('workspaces/:workspaceId/escalation')
@UseGuards(WorkspaceAccessGuard)
export class EscalationController {
  constructor(private readonly escalation: EscalationService) {}

  @Get('policies')
  list(@Actor() actor: ActorContext): Promise<PolicyView[]> {
    return this.escalation.list(actor);
  }

  @Get('runs')
  runs(@Actor() actor: ActorContext): Promise<EscalationRunView[]> {
    return this.escalation.runs(actor);
  }

  @Post('policies')
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createPolicySchema)) body: CreatePolicyInput,
  ): Promise<PolicyView> {
    return this.escalation.create(actor, body);
  }

  @Post('policies/simple')
  @MinRole('admin')
  saveSimple(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(simplePolicySchema)) body: SimplePolicyInput,
  ): Promise<PolicyView> {
    return this.escalation.saveSimple(actor, body);
  }

  @Get('policies/:policyId/preview')
  preview(
    @Actor() actor: ActorContext,
    @Param('policyId', ParseUUIDPipe) id: string,
  ): Promise<PolicyPreview[]> {
    return this.escalation.preview(actor, id);
  }

  @Patch('policies/:policyId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('policyId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePolicySchema)) body: UpdatePolicyInput,
  ): Promise<PolicyView> {
    return this.escalation.update(actor, id, body);
  }

  @Delete('policies/:policyId')
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('policyId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.escalation.remove(actor, id);
  }
}
