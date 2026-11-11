import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { EscalationService } from './escalation.service';

@Injectable()
export class EscalationRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EscalationRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly escalation: EscalationService,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.ESCALATION_RUNNER_ENABLED) return;
    this.timer = setInterval(() => void this.tick(), this.env.ESCALATION_TICK_MS);
    this.logger.log('Escalation runner started');
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.escalation.tick();
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.running = false;
    }
  }
}
