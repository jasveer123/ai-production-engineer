import { Controller, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { rumPayloadSchema } from '@ape/api-contracts';
import type { Request, Response } from 'express';
import { ApiException } from '../../core/common/errors';
import { Public } from '../auth/public.decorator';
import { RumIngestService } from './application/rum-ingest.service';

@Controller('v1/rum')
export class RumIngestController {
  constructor(private readonly ingest: RumIngestService) {}

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
    const result = await this.ingest.ingest(
      appKey,
      parsed.data,
      req.header('user-agent'),
      req.ip ?? '',
    );
    res.status(202).json(result);
  }
}
