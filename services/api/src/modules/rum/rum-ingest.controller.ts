import { Controller, Get, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { rumPayloadSchema, type RumAppSettings } from '@ape/api-contracts';
import type { Request, Response } from 'express';
import { ApiException } from '../../core/common/errors';
import { Public } from '../auth/public.decorator';
import { RumIngestService, settingsOf } from './application/rum-ingest.service';

const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'];

const countryOf = (req: Request): string | null => {
  for (const name of COUNTRY_HEADERS) {
    const value = req.header(name)?.trim().toUpperCase();
    if (value && /^[A-Z]{2}$/.test(value) && value !== 'XX') return value;
  }
  return null;
};

@Controller('v1/rum')
export class RumIngestController {
  constructor(private readonly ingest: RumIngestService) {}

  @Public()
  @Get(':appKey/config')
  async config(@Param('appKey') appKey: string): Promise<RumAppSettings> {
    return settingsOf(await this.ingest.app(appKey));
  }

  @Public()
  @Post(':appKey')
  async collect(
    @Param('appKey') appKey: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    let json: unknown;
    try {
      json = JSON.parse(text || '{}');
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'invalid_body', 'Body is not valid JSON');
    }
    const parsed = rumPayloadSchema.safeParse(json);
    if (!parsed.success)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invalid_payload',
        parsed.error.message.slice(0, 300),
      );
    try {
      const result = await this.ingest.ingest(appKey, parsed.data, {
        ua: req.header('user-agent'),
        ip: req.ip ?? '',
        country: countryOf(req),
      });
      res.status(202).json(result);
    } catch (err) {
      const retry = (err as ApiException).details as { retryAfter?: number } | undefined;
      if (err instanceof ApiException && retry?.retryAfter)
        res.setHeader('Retry-After', String(retry.retryAfter));
      throw err;
    }
  }
}
