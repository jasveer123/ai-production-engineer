import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { SystemStatus } from '@ape/api-contracts';
import { Public } from '../../modules/auth/public.decorator';
import { MinRole } from '../../modules/workspaces/min-role.decorator';
import { WorkspaceAccessGuard } from '../../modules/workspaces/workspace-access.guard';
import { ReadinessService } from './readiness.service';

@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Public()
  @Get()
  check(): { status: 'ok'; service: 'api' } {
    return { status: 'ok', service: 'api' };
  }

  @Public()
  @Get('live')
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<SystemStatus> {
    const status = await this.readiness.check();
    if (status.status === 'down') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return status;
  }
}

@Controller('workspaces/:workspaceId/system-status')
@UseGuards(WorkspaceAccessGuard)
export class SystemStatusController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @MinRole('admin')
  status(): Promise<SystemStatus> {
    return this.readiness.check();
  }
}
