import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { OncallService } from './application/oncall.service';
import { CalendarService } from './application/calendar.service';
import { OncallCalendarController, OncallController } from './oncall.controller';

@Module({
  imports: [WorkspacesModule],
  controllers: [OncallController, OncallCalendarController],
  providers: [OncallService, CalendarService],
  exports: [OncallService],
})
export class OncallModule {}
