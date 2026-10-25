import { gzipSync } from 'node:zlib';

export interface TransportOptions {
  endpoint: string;
  token: string;
  /** Items per request. */
  batchSize: number;
  flushIntervalMs: number;
  maxQueue: number;
  sdkHeader: string;
  /** Called with internal problems; never throws into the app. */
  warn: (message: string) => void;
  fetch?: typeof fetch;
}

type Kind = 'logs' | 'errors';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms).unref?.());

/**
 * Batches items per endpoint and posts them as JSON arrays. Bounded queue (oldest dropped),
 * retries with backoff on network errors, 429 and 5xx, gives up on other 4xx.
 */
export class Transport {
  private readonly queues: Record<Kind, unknown[]> = { logs: [], errors: [] };
  private timer: NodeJS.Timeout | null = null;
  private inflight: Promise<void> = Promise.resolve();
  private dropped = 0;
  private disabled = false;
  private readonly opts: TransportOptions;

  constructor(opts: TransportOptions) {
    this.opts = opts;
  }

  get droppedCount(): number {
    return this.dropped;
  }

  enqueue(kind: Kind, item: unknown): void {
    if (this.disabled) return;
    const q = this.queues[kind];
    q.push(item);
    if (q.length > this.opts.maxQueue) {
      q.splice(0, q.length - this.opts.maxQueue);
      if (this.dropped++ === 0)
        this.opts.warn(`queue full (${this.opts.maxQueue}); dropping the oldest items`);
    }
    // Errors go out right away; logs wait for a batch or the timer.
    if (kind === 'errors' || q.length >= this.opts.batchSize) void this.flush();
    else this.schedule();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.flushIntervalMs);
    this.timer.unref();
  }

  /** Sends everything queued so far. Concurrent calls are chained, never parallel. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.inflight = this.inflight.then(() => this.drain()).catch(() => undefined);
    return this.inflight;
  }

  private async drain(): Promise<void> {
    for (const kind of ['errors', 'logs'] as Kind[]) {
      const q = this.queues[kind];
      while (q.length > 0 && !this.disabled) {
        const batch = q.splice(0, this.opts.batchSize);
        await this.send(kind, batch);
      }
    }
  }

  private async send(kind: Kind, batch: unknown[]): Promise<void> {
    const json = JSON.stringify(batch);
    const gzip = json.length > 16_384;
    const body = gzip ? gzipSync(json) : json;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.token}`,
      'Content-Type': 'application/json',
      'x-ape-sdk': this.opts.sdkHeader,
    };
    if (gzip) headers['Content-Encoding'] = 'gzip';
    const doFetch = this.opts.fetch ?? fetch;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await doFetch(`${this.opts.endpoint}/v1/${kind}`, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return;
        if (res.status === 401) {
          this.disabled = true;
          this.opts.warn(
            'the ingest token was rejected (401). Check APE_TOKEN. Sending is turned off.',
          );
          return;
        }
        if (res.status !== 429 && res.status < 500) {
          this.opts.warn(
            `${kind} batch rejected with HTTP ${res.status}; dropped ${batch.length} items`,
          );
          return;
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 500 * 2 ** attempt);
      } catch (err) {
        if (attempt === 3) {
          this.opts.warn(`could not reach ${this.opts.endpoint}: ${(err as Error).message}`);
          return;
        }
        await sleep(500 * 2 ** attempt);
      }
    }
    this.opts.warn(`gave up sending ${batch.length} ${kind} after retries`);
  }
}
