import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OncallModule } from '../oncall/oncall.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EscalationRunner } from './application/escalation-runner.service';
import { EscalationService } from './application/escalation.service';
import { EscalationController } from './escalation.controller';

@Module({
  imports: [AuthModule, OncallModule, WorkspacesModule],
  controllers: [EscalationController],
  providers: [EscalationService, EscalationRunner],
  exports: [EscalationService],
})
export class EscalationModule {}
