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
  createOverrideSchema,
  createScheduleSchema,
  updateScheduleSchema,
  type CreateOverrideInput,
  type CreateScheduleInput,
  type OncallNow,
  type ScheduleView,
  type UpdateScheduleInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { OncallService } from './application/oncall.service';

@Controller('workspaces/:workspaceId/oncall')
@UseGuards(WorkspaceAccessGuard)
export class OncallController {
  constructor(private readonly oncall: OncallService) {}

  @Get('schedules')
  list(@Actor() actor: ActorContext): Promise<ScheduleView[]> {
    return this.oncall.list(actor);
  }

  @Get('now')
  now(@Actor() actor: ActorContext): Promise<OncallNow[]> {
    return this.oncall.now(actor);
  }

  @Post('schedules')
  @MinRole('admin')
  create(
    @Actor() actor: ActorContext,
    @Body(new ZodValidationPipe(createScheduleSchema)) body: CreateScheduleInput,
  ): Promise<ScheduleView> {
    return this.oncall.create(actor, body);
  }

  @Patch('schedules/:scheduleId')
  @MinRole('admin')
  update(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateScheduleSchema)) body: UpdateScheduleInput,
  ): Promise<ScheduleView> {
    return this.oncall.update(actor, id, body);
  }

  @Delete('schedules/:scheduleId')
  @MinRole('admin')
  @HttpCode(204)
  remove(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.oncall.remove(actor, id);
  }

  @Post('schedules/:scheduleId/overrides')
  @MinRole('engineer')
  addOverride(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createOverrideSchema)) body: CreateOverrideInput,
  ): Promise<ScheduleView> {
    return this.oncall.addOverride(actor, id, body);
  }

  @Delete('overrides/:overrideId')
  @MinRole('engineer')
  @HttpCode(204)
  removeOverride(
    @Actor() actor: ActorContext,
    @Param('overrideId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.oncall.removeOverride(actor, id);
  }
}
