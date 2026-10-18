import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok'; service: 'api' } {
    return { status: 'ok', service: 'api' };
  }
}
