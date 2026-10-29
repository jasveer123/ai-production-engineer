import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { ApiException, notFound } from '../../core/common/errors';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { PullSyncService } from './application/pull-sync.service';

export function verifyGitHubSignature(secret: string, signature: string | undefined, body: Buffer) {
  if (!signature) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

@Controller('webhooks')
export class GitHubWebhookController {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly sync: PullSyncService,
  ) {}

  @Public()
  @Post('github')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(@Req() req: Request): Promise<{ accepted: true; tracked: boolean }> {
    const secret = this.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) throw notFound('Webhook');
    if (
      !verifyGitHubSignature(
        secret,
        req.header('x-hub-signature-256'),
        req.rawBody ?? Buffer.alloc(0),
      )
    ) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'bad_signature', 'Invalid webhook signature');
    }
    const body = req.body as {
      repository?: { full_name?: string };
      pull_request?: { number?: number };
      check_run?: { pull_requests?: { number: number }[] };
      check_suite?: { pull_requests?: { number: number }[] };
    };
    const repo = body.repository?.full_name;
    const numbers = [
      body.pull_request?.number,
      ...(body.check_run?.pull_requests ?? []).map((p) => p.number),
      ...(body.check_suite?.pull_requests ?? []).map((p) => p.number),
    ].filter((n): n is number => typeof n === 'number');
    let tracked = false;
    if (repo)
      for (const n of new Set(numbers))
        tracked = (await this.sync.syncByNumber(repo, n)) || tracked;
    return { accepted: true, tracked };
  }
}
