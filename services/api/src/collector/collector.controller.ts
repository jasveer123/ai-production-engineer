import { Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { IngestWay } from '@ape/api-contracts';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { ApiException } from '../common/errors';
import {
  BadPayload,
  jsonLogsToBatch,
  sdkErrorsToBatch,
  vercelToBatch,
  type Defaults,
} from './formats';
import { IngestTokensService } from './ingest-tokens.service';
import { logsToBatch, metricsToBatch, tracesToBatch } from './otlp';
import { decodeLogs, decodeMetrics, decodeTraces } from './protobuf';
import { logplexToBatch } from './syslog-format';
import { TelemetryStore } from './telemetry-store.service';
import type { Batch } from './types';

/** Token from `Authorization: Bearer|Basic`, `X-Ape-Token`, `Logplex-Drain-Token`-style URL auth, or `?token=`. */
export function ingestTokenOf(req: Request): string | null {
  const auth = req.header('authorization');
  if (auth) {
    const [scheme, value] = auth.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && value) return value.trim();
    if (scheme?.toLowerCase() === 'basic' && value) {
      // Heroku and others put credentials in the drain URL: https://user:TOKEN@host/...
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

/** Which way the data came by, for the per-way status on the integrations page. */
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

/**
 * Public telemetry intake (Ways 1-5). Authentication is the workspace ingest token. Bodies arrive
 * raw (see app.setup.ts) so protobuf, NDJSON and logplex work; gzip is inflated by the parser.
 */
@Controller('v1')
export class CollectorController {
  constructor(
    private readonly tokens: IngestTokensService,
    private readonly store: TelemetryStore,
  ) {}

  private async workspace(req: Request): Promise<string> {
    const ws = await this.tokens.resolve(ingestTokenOf(req));
    if (!ws)
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_token',
        'Missing or unknown ingest token',
      );
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

  /** OTLP success: an empty Export*ServiceResponse in the request's encoding. */
  private otlpOk(req: Request, res: Response): void {
    if (isProtobuf(req)) res.status(200).type('application/x-protobuf').send(Buffer.alloc(0));
    else res.status(200).json({ partialSuccess: {} });
  }

  @Public()
  @Post('traces')
  async traces(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const way = wayOf(req, 'otlp');
    const batch = this.decode(() =>
      tracesToBatch(
        (isProtobuf(req) ? decodeTraces(this.body(req)) : this.json(req)) as Parameters<
          typeof tracesToBatch
        >[0],
        way,
      ),
    );
    await this.store.write(ws, batch);
    this.otlpOk(req, res);
  }

  @Public()
  @Post('metrics')
  async metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const batch = this.decode(() =>
      metricsToBatch(
        (isProtobuf(req) ? decodeMetrics(this.body(req)) : this.json(req)) as Parameters<
          typeof metricsToBatch
        >[0],
      ),
    );
    batch.way = wayOf(req, 'otlp');
    await this.store.write(ws, batch);
    this.otlpOk(req, res);
  }

  /** OTLP logs, or plain JSON / NDJSON logs from the HTTP API, Vector and Fluent Bit. */
  @Public()
  @Post('logs')
  async logs(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    if (isProtobuf(req)) {
      const batch = this.decode(() =>
        logsToBatch(
          decodeLogs(this.body(req)) as Parameters<typeof logsToBatch>[0],
          wayOf(req, 'otlp'),
        ),
      );
      await this.store.write(ws, batch);
      return this.otlpOk(req, res);
    }
    const text = this.body(req).toString('utf8');
    if (/^\s*\{\s*"resourceLogs"/.test(text)) {
      const batch = this.decode(() =>
        logsToBatch(this.json(req) as Parameters<typeof logsToBatch>[0], wayOf(req, 'otlp')),
      );
      await this.store.write(ws, batch);
      return this.otlpOk(req, res);
    }
    const batch = this.plain(() => jsonLogsToBatch(text, wayOf(req, 'http'), this.defaults(req)));
    const written = await this.store.write(ws, batch);
    res
      .status(202)
      .json({ accepted: batch.logs.length, stored: written.logs, errors: batch.errors.length });
  }

  /** Error events from our SDKs (or anything that posts the same shape). */
  @Public()
  @Post('errors')
  async errors(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ws = await this.workspace(req);
    const batch = this.plain(() =>
      sdkErrorsToBatch(this.body(req).toString('utf8'), this.defaults(req)),
    );
    batch.way = wayOf(req, 'http');
    await this.store.write(ws, batch);
    res.status(202).json({ accepted: batch.errors.length });
  }

  /** Log drains: Vercel (JSON / NDJSON) and Heroku (application/logplex-1). */
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
      await this.store.write(ws, batch);
      // Logplex wants an empty body.
      res.status(204).setHeader('Content-Length', '0');
      res.end();
      return;
    }
    const batch = this.plain(() => vercelToBatch(text, this.defaults(req)));
    batch.way = wayOf(req, 'drain');
    await this.store.write(ws, batch);
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
