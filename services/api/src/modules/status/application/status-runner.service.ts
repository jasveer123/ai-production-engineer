import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { StatusAutomationService } from './status-automation.service';

@Injectable()
export class StatusRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StatusRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly automation: StatusAutomationService,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.MONITOR_RUNNER_ENABLED) return;
    this.timer = setInterval(() => void this.tick(), this.env.MONITOR_TICK_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.automation.tick();
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.running = false;
    }
  }
}
