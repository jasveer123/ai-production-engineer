import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  pageAccessSchema,
  subscribeSchema,
  type PageAccessInput,
  type PublicHistory,
  type PublicStatus,
  type SubscribeInput,
} from '@ape/api-contracts';
import { ApiException } from '../../core/common/errors';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { Public } from '../auth/public.decorator';
import { RateLimiter } from '../auth/rate-limit';
import { PublicStatusService } from './application/public-status.service';
import type { PageRow } from './application/status.service';
import { SubscribersService } from './application/subscribers.service';

const subscribeByIp = new RateLimiter(10, 10 * 60_000);
const subscribeByEmail = new RateLimiter(3, 60 * 60_000);
const accessByIp = new RateLimiter(10, 60_000);
const ACCESS_HEADER = 'x-status-access';

const cacheFor = (res: Response, page: PageRow) =>
  res.setHeader(
    'Cache-Control',
    page.passwordHash ? 'private, no-store' : 'public, max-age=30, stale-while-revalidate=30',
  );

const monthOf = (value: string | undefined, now = new Date()) => {
  if (!value) return now.toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new ApiException(400, 'invalid_month', 'Use a month like 2026-11');
  return value;
};

@Controller('public/status')
export class PublicStatusController {
  constructor(
    private readonly pub: PublicStatusService,
    private readonly subscribers: SubscribersService,
  ) {}

  @Public()
  @Get('domain/:host')
  async byDomain(
    @Param('host') host: string,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicStatus> {
    const page = await this.pub.page({ host }, access);
    cacheFor(res, page);
    return this.pub.view(page);
  }

  @Public()
  @Get('subscriptions/confirm')
  confirm(@Query('token') token: string): Promise<{ page: string }> {
    return this.subscribers.confirm(token ?? '');
  }

  @Public()
  @Get('subscriptions/unsubscribe')
  unsubscribe(@Query('token') token: string): Promise<{ page: string }> {
    return this.subscribers.unsubscribe(token ?? '');
  }

  @Public()
  @Post(':slug/subscribe')
  @HttpCode(202)
  async subscribe(
    @Param('slug') slug: string,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(subscribeSchema)) body: SubscribeInput,
  ): Promise<{ ok: true }> {
    subscribeByIp.check(ip);
    subscribeByEmail.check(`${slug.toLowerCase()}:${body.email}`);
    await this.subscribers.subscribe(slug.toLowerCase(), body.email);
    return { ok: true };
  }

  @Public()
  @Post(':slug/access')
  @HttpCode(200)
  access(
    @Param('slug') slug: string,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(pageAccessSchema)) body: PageAccessInput,
  ): Promise<{ token: string }> {
    accessByIp.check(ip);
    return this.pub.grantAccess(slug, body.password);
  }

  @Public()
  @Get(':slug/history')
  async history(
    @Param('slug') slug: string,
    @Query('month') month: string | undefined,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicHistory> {
    const page = await this.pub.page({ slug }, access);
    cacheFor(res, page);
    return this.pub.monthHistory(page, monthOf(month));
  }

  @Public()
  @Get(':slug/summary.json')
  async summary(
    @Param('slug') slug: string,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const page = await this.pub.page({ slug }, access);
    cacheFor(res, page);
    return this.pub.summary(page);
  }

  @Public()
  @Get(':slug/feed.atom')
  async atom(
    @Param('slug') slug: string,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const page = await this.pub.page({ slug }, access);
    cacheFor(res, page);
    res.type('application/atom+xml; charset=utf-8');
    return this.pub.feed(page, 'atom');
  }

  @Public()
  @Get(':slug/feed.rss')
  async rss(
    @Param('slug') slug: string,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const page = await this.pub.page({ slug }, access);
    cacheFor(res, page);
    res.type('application/rss+xml; charset=utf-8');
    return this.pub.feed(page, 'rss');
  }

  @Public()
  @Get(':slug')
  async view(
    @Param('slug') slug: string,
    @Headers(ACCESS_HEADER) access: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicStatus> {
    const page = await this.pub.page({ slug }, access);
    cacheFor(res, page);
    return this.pub.view(page);
  }
}
