import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { AlertSourcesService } from '../../../modules/alerts/application/alert-sources.service';
import { GitHubService } from '../../../connectors/github/github.service';
import { IngestionProcessor } from './ingestion.processor';
import { JaegerPoller } from './jaeger.poller';

@Injectable()
export class IngestionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(IngestionWorker.name);
  private timers: NodeJS.Timeout[] = [];
  private processing = false;
  private polling = false;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly processor: IngestionProcessor,
    private readonly poller: JaegerPoller,
    private readonly github: GitHubService,
    private readonly alertSources: AlertSourcesService,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.INGEST_WORKER_ENABLED) return;
    this.timers.push(
      setInterval(() => void this.tick(), this.env.INGEST_POLL_INTERVAL_MS),
      setInterval(() => void this.poll(), this.env.JAEGER_POLL_INTERVAL_MS),

      setInterval(
        () => void this.github.checkAll().catch((e: unknown) => this.logger.error(e)),
        this.env.GITHUB_HEALTH_INTERVAL_MS,
      ),

      setInterval(
        () =>
          void this.alertSources
            .checkHeartbeats()
            .then((n) => n > 0 && this.logger.warn(`${n} heartbeat(s) missed`))
            .catch((e: unknown) => this.logger.error(e)),
        this.env.HEARTBEAT_CHECK_INTERVAL_MS,
      ),
    );
    this.logger.log('Ingestion worker started');
  }

  onApplicationShutdown() {
    this.timers.forEach(clearInterval);
  }

  private async tick() {
    if (this.processing) return;
    this.processing = true;
    try {
      const r = await this.processor.processBatch();
      if (r.processed + r.retried + r.dead > 0)
        this.logger.log(`Processed batch: ${JSON.stringify(r)}`);
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.processing = false;
    }
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const n = await this.poller.pollAll();
      if (n > 0) this.logger.log(`Jaeger poll queued ${n} new error event(s)`);
    } catch (err) {
      this.logger.error(err);
    } finally {
      this.polling = false;
    }
  }
}
