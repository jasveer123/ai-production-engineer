import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { MetricAlertEvaluator } from './metric-alert-evaluator.service';

@Injectable()
export class MetricAlertRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MetricAlertRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly evaluator: MetricAlertEvaluator,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.MONITOR_RUNNER_ENABLED) return;
    this.timer = setInterval(() => void this.tick(), this.env.MONITOR_TICK_MS);
    this.timer.unref();
    this.logger.log('Metric alert evaluator started');
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.evaluator.runDue();
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.running = false;
    }
  }
}
