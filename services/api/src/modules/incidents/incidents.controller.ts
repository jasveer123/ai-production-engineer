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
  responseActionSchema,
  createIncidentSchema,
  incidentListQuerySchema,
  severityRulesSchema,
  transitionIncidentSchema,
  type ApprovalPolicyInput,
  type CreateIncidentInput,
  type Incident,
  type ResponseActionInput,
  type SeverityRule,
  type TimelineEntry,
  type TransitionIncidentInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { IncidentReader } from './application/incident-reader';
import { IncidentResponseService } from './application/incident-response.service';
import { IncidentsService } from './incidents.service';

@Controller(['workspaces/:workspaceId', 'api/v1/workspaces/:workspaceId'])
@UseGuards(WorkspaceAccessGuard)
export class IncidentsController {
  constructor(
    private readonly svc: IncidentsService,
    private readonly reader: IncidentReader,
    private readonly response: IncidentResponseService,
  ) {}

  @Get('incidents')
  list(
    @Actor() actor: ActorContext,
    @Query(new ZodValidationPipe(incidentListQuerySchema))
    q: ReturnType<typeof incidentListQuerySchema.parse>,
  ): Promise<Incident[]> {
    return this.reader.list(actor.workspaceId, q);
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
    return this.reader.get(actor.workspaceId, id);
  }

  @Get('incidents/:incidentId/timeline')
  timeline(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
  ): Promise<TimelineEntry[]> {
    return this.svc.timeline(actor, id);
  }

  @Post('incidents/:incidentId/acknowledge')
  @MinRole('engineer')
  @HttpCode(200)
  acknowledge(
    @Actor() actor: ActorContext,
    @Param('incidentId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(responseActionSchema.default({}))) body: ResponseActionInput,
  ): Promise<Incident> {
    return this.response.respond(actor, id, 'acknowledge', body);
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

  @Put('settings/approval-policy')
  @MinRole('owner')
  setApprovalPolicy(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(approvalPolicySchema)) body: ApprovalPolicyInput,
  ): Promise<ApprovalPolicyInput> {
    return this.svc.setApprovalPolicy(actor, body);
  }
}
