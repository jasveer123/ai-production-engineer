import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  approvalPolicySchema,
  createIncidentSchema,
  incidentListQuerySchema,
  severityRulesSchema,
  transitionIncidentSchema,
  type ApprovalPolicyInput,
  type CreateIncidentInput,
  type Incident,
  type SeverityRule,
  type TimelineEntry,
  type TransitionIncidentInput,
} from '@ape/api-contracts';
import { Actor } from '../common/actor.decorator';
import type { ActorContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { IncidentsService } from './incidents.service';

@Controller('workspaces/:workspaceId')
@UseGuards(WorkspaceAccessGuard)
export class IncidentsController {
  constructor(private readonly svc: IncidentsService) {}

  @Get('incidents')
  list(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(incidentListQuerySchema))
    q: ReturnType<typeof incidentListQuerySchema.parse>,
  ): Promise<Incident[]> {
    return this.svc.list(actor, q);
  }

  @Post('incidents')
  @MinRole('engineer')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createIncidentSchema)) body: CreateIncidentInput,
  ): Promise<Incident> {
    return this.svc.create(actor, body);
  }

  @Get('incidents/:incidentId')
  get(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<Incident> {
    return this.svc.get(actor, id);
  }

  @Get('incidents/:incidentId/timeline')
  timeline(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<TimelineEntry[]> {
    return this.svc.timeline(actor, id);
  }

  @Post('incidents/:incidentId/transitions')
  @MinRole('engineer')
  @HttpCode(200)
  transition(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transitionIncidentSchema)) body: TransitionIncidentInput,
  ): Promise<Incident> {
    return this.svc.transition(actor, id, body);
  }

  @Get('settings/severity-rules')
  severityRules(@Actor() actor: ActorContext): Promise<SeverityRule[]> {
    return this.svc.severityRules(actor);
  }

  @Put('settings/severity-rules')
  @MinRole('admin')
  setSeverityRules(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(severityRulesSchema)) body: { rules: SeverityRule[] },
  ): Promise<SeverityRule[]> {
    return this.svc.setSeverityRules(actor, body.rules);
  }

  @Get('settings/approval-policy')
  approvalPolicy(@Actor() actor: ActorContext): Promise<ApprovalPolicyInput> {
    return this.svc.approvalPolicy(actor);
  }

  /** Who may approve opening a pull request. Owner only: it changes the approval gate itself. */
  @Put('settings/approval-policy')
  @MinRole('owner')
  setApprovalPolicy(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(approvalPolicySchema)) body: ApprovalPolicyInput,
  ): Promise<ApprovalPolicyInput> {
    return this.svc.setApprovalPolicy(actor, body);
  }
}
