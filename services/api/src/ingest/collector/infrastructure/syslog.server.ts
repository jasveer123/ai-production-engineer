import { readFileSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { createServer as createTlsServer } from 'node:tls';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { parseSyslog, syslogToken, syslogToLog } from '../domain/syslog-format';
import { IngestTokensService } from '../application/ingest-tokens.service';
import { TelemetryStore } from '../application/telemetry-store.service';
import { emptyBatch, type Batch } from '../domain/types';

const MAX_FRAME = 64 * 1024;
const FLUSH_MS = 1000;

@Injectable()
export class SyslogServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyslogServer.name);
  private server: Server | null = null;

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly tokens: IngestTokensService,
    private readonly store: TelemetryStore,
  ) {}

  get tls(): boolean {
    return Boolean(this.env.SYSLOG_TLS_CERT_PATH && this.env.SYSLOG_TLS_KEY_PATH);
  }

  onModuleInit(): void {
    if (!this.env.SYSLOG_ENABLED || !this.env.INGEST_WORKER_ENABLED) return;
    const onConn = (socket: Socket) => this.handle(socket);
    this.server = this.tls
      ? createTlsServer(
          {
            cert: readFileSync(this.env.SYSLOG_TLS_CERT_PATH!),
            key: readFileSync(this.env.SYSLOG_TLS_KEY_PATH!),
          },
          onConn,
        )
      : createServer(onConn);
    this.server.on('error', (err) => this.logger.warn(`Syslog listener: ${err.message}`));
    this.server.listen(this.env.SYSLOG_PORT, () =>
      this.logger.log(`Syslog listening on ${this.env.SYSLOG_PORT}${this.tls ? ' (TLS)' : ''}`),
    );
  }

  onModuleDestroy(): void {
    this.server?.close();
  }

  private handle(socket: Socket): void {
    let buf = Buffer.alloc(0);
    const pending = new Map<string, Batch>();
    let timer: NodeJS.Timeout | null = null;

    const flush = async () => {
      timer = null;
      const batches = [...pending.entries()];
      pending.clear();
      for (const [ws, batch] of batches) {
        await this.store
          .write(ws, batch)
          .catch((err: Error) => this.logger.warn(`Syslog write failed: ${err.message}`));
      }
    };

    const onLine = async (line: string) => {
      const msg = parseSyslog(line);
      if (!msg) return;
      const ws = await this.tokens.resolve(syslogToken(msg));
      if (!ws) return;
      const batch = pending.get(ws) ?? emptyBatch('syslog');
      batch.logs.push(syslogToLog(msg));
      pending.set(ws, batch);
      timer ??= setTimeout(() => void flush(), FLUSH_MS);
    };

    socket.setTimeout(10 * 60 * 1000, () => socket.destroy());
    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length === 0) break;
        const sp = buf.indexOf(0x20);
        const head = sp > 0 ? buf.subarray(0, sp).toString('ascii') : '';
        if (/^\d{1,6}$/.test(head)) {
          const len = Number(head);
          if (len > MAX_FRAME) return socket.destroy();
          if (buf.length < sp + 1 + len) break;
          void onLine(buf.subarray(sp + 1, sp + 1 + len).toString('utf8'));
          buf = buf.subarray(sp + 1 + len);
          continue;
        }
        const nl = buf.indexOf(0x0a);
        if (nl < 0) {
          if (buf.length > MAX_FRAME) return socket.destroy();
          break;
        }
        const line = buf.subarray(0, nl).toString('utf8').replace(/\r$/, '');
        buf = buf.subarray(nl + 1);
        if (line.trim()) void onLine(line);
      }
    });
    socket.on('end', () => void flush());
    socket.on('error', () => socket.destroy());
  }
}
