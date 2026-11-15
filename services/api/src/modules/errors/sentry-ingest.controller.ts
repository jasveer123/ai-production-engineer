import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { SentryIngestService, SentryRateLimited } from './application/sentry-ingest.service';
import { parseSentryAuth } from './domain/sentry-envelope';

const keyOf = (req: Request): string | null =>
  parseSentryAuth(req.header('x-sentry-auth')) ??
  parseSentryAuth(req.header('authorization')) ??
  (typeof req.query.sentry_key === 'string' ? req.query.sentry_key : null);

const bodyOf = (req: Request): Buffer => (Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));

@Controller('api/:projectId')
export class SentryIngestController {
  constructor(private readonly ingest: SentryIngestService) {}

  private async run(res: Response, work: () => Promise<{ id: string | null }>): Promise<void> {
    try {
      res.status(200).json(await work());
    } catch (err) {
      if (!(err instanceof SentryRateLimited)) throw err;
      res.setHeader('Retry-After', String(err.retryAfter));
      res.setHeader('X-Sentry-Rate-Limits', `${err.retryAfter}:error;default:project`);
      res
        .status(429)
        .json({ code: 'rate_limited', message: 'Spike protection is dropping events' });
    }
  }

  @Public()
  @Post('envelope')
  async envelope(
    @Param('projectId') projectId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const app = await this.ingest.authenticate(projectId, keyOf(req));
    await this.run(res, () => this.ingest.envelope(app, bodyOf(req)));
  }

  @Public()
  @Post('store')
  async store(
    @Param('projectId') projectId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const app = await this.ingest.authenticate(projectId, keyOf(req));
    await this.run(res, () => this.ingest.store(app, bodyOf(req)));
  }
}
