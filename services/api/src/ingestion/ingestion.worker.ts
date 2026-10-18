import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ENV, type ApiEnv } from '../config/config.module';
import { IngestionProcessor } from './ingestion.processor';
import { JaegerPoller } from './jaeger.poller';

/** Runs the processor and poller on intervals inside the API process (ADR-006: no broker yet). */
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
  ) {}

  onApplicationBootstrap() {
    if (!this.env.INGEST_WORKER_ENABLED) return;
    this.timers.push(
      setInterval(() => void this.tick(), this.env.INGEST_POLL_INTERVAL_MS),
      setInterval(() => void this.poll(), this.env.JAEGER_POLL_INTERVAL_MS),
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
