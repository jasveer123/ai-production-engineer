import { Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ApiException, notFound } from '../../core/common/errors';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { Public } from '../auth/public.decorator';
import { DeliveryLedger } from './application/delivery-ledger.service';
import { verifyTwilioSignature } from './domain/twilio-signature';
import { TWILIO_STATUS_PATH } from './infrastructure/notification-sender.service';

const callbackSchema = z
  .object({
    MessageSid: z.string().max(64).optional(),
    CallSid: z.string().max(64).optional(),
    MessageStatus: z.string().max(32).optional(),
    CallStatus: z.string().max(32).optional(),
    ErrorCode: z.string().max(16).optional(),
  })
  .passthrough();

@Controller('notifications/twilio')
export class TwilioCallbackController {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly ledger: DeliveryLedger,
  ) {}

  @Public()
  @Post('status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async status(@Req() req: Request): Promise<void> {
    const token = this.env.TWILIO_AUTH_TOKEN;
    if (!token) throw notFound('Callback');
    const params = Object.fromEntries(
      Object.entries((req.body ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
    const url = `${this.env.PUBLIC_API_URL}${TWILIO_STATUS_PATH}`;
    if (!verifyTwilioSignature(token, url, params, req.header('x-twilio-signature')))
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'bad_signature', 'Invalid Twilio signature');
    const body = callbackSchema.parse(params);
    const sid = body.MessageSid ?? body.CallSid;
    const status = body.MessageStatus ?? body.CallStatus;
    if (!sid || !status) return;
    await this.ledger.applyProviderStatus(
      sid,
      status,
      body.ErrorCode ? `Twilio reported ${status} (error ${body.ErrorCode})` : undefined,
    );
  }
}
