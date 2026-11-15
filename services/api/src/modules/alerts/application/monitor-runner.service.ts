import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { LogAlertsService } from './log-alerts.service';
import { MonitorExecutor } from './monitor-executor.service';
import { MonitorsService } from './monitors.service';

const PURGE_EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class MonitorRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MonitorRunner.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly monitors: MonitorsService,
    private readonly executor: MonitorExecutor,
    private readonly logAlerts: LogAlertsService,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.MONITOR_RUNNER_ENABLED) return;
    this.timers.push(
      setInterval(() => void this.tick(), this.env.MONITOR_TICK_MS),
      setInterval(
        () => void this.monitors.purgeOld().catch((err: unknown) => this.logger.error(err)),
        PURGE_EVERY_MS,
      ),
    );
    this.logger.log('Monitor runner started');
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.executor.runDue();
      // Expiry lookups are slow (TLS, RDAP); claiming moves their next run forward, so they may overlap ticks.
      void this.executor.runExpiryChecks().catch((err: unknown) => this.logger.error(err));
      await this.logAlerts.runDue();
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.running = false;
    }
  }
}
