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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createOverrideSchema,
  coverageQuerySchema,
  createScheduleSchema,
  updateScheduleSchema,
  type CreateOverrideInput,
  type CalendarLink,
  type CoverageQuery,
  type CreateScheduleInput,
  type ScheduleCoverage,
  type OncallNow,
  type ScheduleView,
  type UpdateScheduleInput,
} from '@ape/api-contracts';
import { Actor } from '../../core/common/actor.decorator';
import type { ActorContext } from '../../core/common/request-context';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { MinRole } from '../workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../workspaces/workspace-access.guard';
import { Public } from '../auth/public.decorator';
import { CalendarService } from './application/calendar.service';
import { OncallService } from './application/oncall.service';

@Controller(['workspaces/:workspaceId/oncall', 'api/v1/workspaces/:workspaceId/oncall'])
@UseGuards(WorkspaceAccessGuard)
export class OncallController {
  constructor(
    private readonly oncall: OncallService,
    private readonly calendar: CalendarService,
  ) {}

  @Get('schedules/:scheduleId/coverage')
  coverage(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(coverageQuerySchema)) q: CoverageQuery,
  ): Promise<ScheduleCoverage> {
    return this.oncall.coverage(actor, id, new Date(q.from), new Date(q.to));
  }

  @Post('schedules/:scheduleId/calendar-link')
  @MinRole('admin')
  @HttpCode(200)
  enableCalendar(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
  ): Promise<CalendarLink> {
    return this.calendar.enable(actor, id);
  }

  @Delete('schedules/:scheduleId/calendar-link')
  @MinRole('admin')
  @HttpCode(204)
  revokeCalendar(
    @Actor() actor: ActorContext,
    @Param('scheduleId', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.calendar.revoke(actor, id);
  }

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

@Controller('public/oncall')
export class OncallCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Public()
  @Get(':scheduleId/calendar.ics')
  async feed(
    @Param('scheduleId') id: string,
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const body = await this.calendar.feed(id, typeof token === 'string' ? token : undefined);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return body;
  }
}
