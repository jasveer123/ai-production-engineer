import { Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { IngestResult, IngestWay } from '@ape/api-contracts';
import type { Request, Response } from 'express';
import { Public } from '../../modules/auth/public.decorator';
import { ApiException } from '../../core/common/errors';
import {
  BadPayload,
  jsonLogsToBatch,
  sdkErrorsToBatch,
  vercelToBatch,
  type Defaults,
} from './domain/formats';
import { IngestTokensService } from './application/ingest-tokens.service';
import { prometheusTextToBatch, prometheusToBatch } from './domain/prometheus';
import { jsonMetricsToBatch } from './domain/json-metrics';
import { metricsToBatch, otlpPartialSuccess } from './domain/otlp-metrics';
import { Writer } from './domain/protobuf-writer';
import { acceptedOf, type ReceiptOptions } from './application/ingest-receipts.service';
import { snappyDecode } from './domain/snappy';
import { logsToBatch, tracesToBatch } from './domain/otlp';
import { decodeLogs, decodeMetrics, decodeTraces } from './domain/protobuf';
import { logplexToBatch } from './domain/syslog-format';
import { TelemetryStore } from './application/telemetry-store.service';
import type { Batch } from './domain/types';

export function ingestTokenOf(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth) {
    const [scheme, value] = auth.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && value) return value.trim();
    if (scheme?.toLowerCase() === 'basic' && value) {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      return pass || decoded.split(':')[0] || null;
    }
  }
  const header = req.header('x-ape-token');
  if (header) return header.trim();
  return typeof req.query.token === 'string' ? req.query.token : null;
}

const q = (req: Request, key: string) =>
  typeof req.query[key] === 'string' && req.query[key].trim()
    ? req.query[key].trim().slice(0, 100)
    : null;

function wayOf(req: Request, fallback: IngestWay): IngestWay {
  const explicit = q(req, 'way');
  if (explicit && ['package', 'otlp', 'http', 'agent', 'drain'].includes(explicit))
    return explicit as IngestWay;
  if (req.header('x-ape-sdk')) return 'package';
  const ua = (req.header('user-agent') ?? '').toLowerCase();
  if (
    /vector\/|fluent-?bit|fluentd|logstash|filebeat|promtail|otelcol|opentelemetry collector/.test(
      ua,
    )
  )
    return 'agent';
  return fallback;
}

const isProtobuf = (req: Request) => /protobuf/i.test(req.header('content-type') ?? '');

@Controller('v1')
export class CollectorController {
  constructor(
    private readonly tokens: IngestTokensService,
    private readonly store: TelemetryStore,
  ) {}

  private async workspace(req: Request): Promise<string> {
    const cached = (req as Request & { apeWorkspace?: string }).apeWorkspace;
    if (cached) return cached;
    const ws = await this.tokens.resolve(ingestTokenOf(req));
    if (!ws)
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_token',
        'Missing or unknown ingest token',
      );
    (req as Request & { apeWorkspace?: string }).apeWorkspace = ws;
    return ws;
  }

  private body(req: Request): Buffer {
    return Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  }

  private json(req: Request): unknown {
    const text = this.body(req).toString('utf8');
    if (!text.trim()) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', 'Body is not valid JSON');
    }
  }

  private decode<T>(fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invalid_body',
        (err as Error).message.slice(0, 300),
      );
    }
  }

  private defaults(req: Request): Defaults {
    return { service: q(req, 'service'), environment: q(req, 'env') ?? q(req, 'environment') };
  }

  private opts(req: Request, route: string, signal: ReceiptOptions['signal']): ReceiptOptions {
    const key =
      req.header('idempotency-key') ?? req.header('x-batch-id') ?? q(req, 'batch_id') ?? null;
    return { route, signal, idempotencyKey: key?.trim() || null };
  }

  private async otlp(req: Request, res: Response, batch: Batch, opts: ReceiptOptions) {
    const ws = await this.workspace(req);
    const written = await this.store.write(ws, batch, opts);
    if (written.receiptId) res.setHeader('x-ape-receipt-id', written.receiptId);
    const outcome = otlpPartialSuccess(opts.signal, batch);
    if (isProtobuf(req)) {
      const body = outcome
        ? new Writer()
            .message(1, new Writer().uint(1, batch.rejected).string(2, outcome.errorMessage))
            .finish()
        : Buffer.alloc(0);
      res.status(200).type('application/x-protobuf').send(Buffer.from(body));
    } else res.status(200).json({ partialSuccess: outcome ?? {} });
  }

  private async custom(req: Request, res: Response, batch: Batch, opts: ReceiptOptions) {
    const ws = await this.workspace(req);
    const written = await this.store.write(ws, batch, opts);
    const result: IngestResult & { stored: number; errors: number } = {
      receiptId: written.receiptId,
      accepted: acceptedOf(batch),
      rejected: batch.rejected,
      rejections: batch.rejections,
      stored: opts.signal === 'logs' ? written.logs : batch.points.length,
      errors: batch.errors.length,
    };
    res.status(202).json(result);
  }

  @Public()
  @Post('traces')
  async traces(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.workspace(req);
    const batch = this.decode(() =>
      tracesToBatch(
        (isProtobuf(req) ? decodeTraces(this.body(req)) : this.json(req)) as Parameters<
          typeof tracesToBatch
        >[0],
        wayOf(req, 'otlp'),
      ),
    );
    await this.otlp(req, res, batch, this.opts(req, 'otlp', 'traces'));
  }

  @Public()
  @Post('metrics')
  async metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.workspace(req);
    const text = isProtobuf(req) ? '' : this.body(req).toString('utf8');
    if (/text\/plain|openmetrics/i.test(req.header('content-type') ?? ''))
      return this.prometheusPush(req, res);
    if (/^\s*\[/.test(text) || /^\s*\{\s*"name"/.test(text)) {
      const batch = this.plain(() => jsonMetricsToBatch(text, this.defaults(req)));
      batch.way = wayOf(req, 'http');
      return this.custom(req, res, batch, this.opts(req, 'http', 'metrics'));
    }
    const batch = this.decode(() =>
      metricsToBatch(
        (isProtobuf(req) ? decodeMetrics(this.body(req)) : this.json(req)) as Parameters<
          typeof metricsToBatch
        >[0],
      ),
    );
    batch.way = wayOf(req, 'otlp');
    await this.otlp(req, res, batch, this.opts(req, 'otlp', 'metrics'));
  }

  @Public()
  @Post('prometheus/write')
  async prometheusWrite(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const batch = this.decode(() => {
      const raw = this.body(req);
      const encoding = (req.header('content-encoding') ?? 'snappy').toLowerCase();
      return prometheusToBatch(encoding === 'snappy' ? snappyDecode(raw) : raw);
    });
    const written = await this.store.write(
      ws,
      batch,
      this.opts(req, 'prometheus_write', 'metrics'),
    );
    if (written.receiptId) res.setHeader('x-ape-receipt-id', written.receiptId);
    if (batch.rejected > 0 && batch.points.length === 0)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', batch.rejectReason ?? '');
    res.status(204).send();
  }

  @Public()
  @Post('prometheus/push')
  async prometheusPush(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.workspace(req);
    const batch = prometheusTextToBatch(this.body(req).toString('utf8'));
    await this.custom(req, res, batch, this.opts(req, 'prometheus_push', 'metrics'));
  }

  @Public()
  @Post('logs')
  async logs(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.workspace(req);
    if (isProtobuf(req)) {
      const batch = this.decode(() =>
        logsToBatch(
          decodeLogs(this.body(req)) as Parameters<typeof logsToBatch>[0],
          wayOf(req, 'otlp'),
        ),
      );
      return this.otlp(req, res, batch, this.opts(req, 'otlp', 'logs'));
    }
    const text = this.body(req).toString('utf8');
    if (/^\s*\{\s*"resourceLogs"/.test(text)) {
      const batch = this.decode(() =>
        logsToBatch(this.json(req) as Parameters<typeof logsToBatch>[0], wayOf(req, 'otlp')),
      );
      return this.otlp(req, res, batch, this.opts(req, 'otlp', 'logs'));
    }
    const batch = this.plain(() => jsonLogsToBatch(text, wayOf(req, 'http'), this.defaults(req)));
    await this.custom(req, res, batch, this.opts(req, 'http', 'logs'));
  }

  @Public()
  @Post('errors')
  async errors(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const batch = this.plain(() =>
      sdkErrorsToBatch(this.body(req).toString('utf8'), this.defaults(req)),
    );
    batch.way = wayOf(req, 'http');
    const written = await this.store.write(ws, batch, this.opts(req, 'http', 'errors'));
    res.status(202).json({ accepted: batch.errors.length, receiptId: written.receiptId });
  }

  @Public()
  @Post('drain')
  async drain(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const text = this.body(req).toString('utf8');
    const verify = q(req, 'verify');
    if (verify) res.setHeader('x-vercel-verify', verify);

    if (/logplex/i.test(req.header('content-type') ?? '')) {
      const batch = this.plain(() =>
        logplexToBatch(text, req.header('logplex-frame-id') ?? null, this.defaults(req)),
      );
      await this.store.write(ws, batch, this.opts(req, 'logplex', 'logs'));

      res.status(204).setHeader('Content-Length', '0');
      res.end();
      return;
    }
    const batch = this.plain(() => vercelToBatch(text, this.defaults(req)));
    batch.way = wayOf(req, 'drain');
    await this.store.write(ws, batch, this.opts(req, 'drain', 'logs'));
    res.status(200).json({ accepted: batch.logs.length });
  }

  private plain(fn: () => Batch): Batch {
    try {
      return fn();
    } catch (err) {
      if (err instanceof BadPayload)
        throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', err.message);
      throw err;
    }
  }
}
