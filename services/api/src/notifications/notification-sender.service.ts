import { Inject, Injectable } from '@nestjs/common';
import { SLACK_WEBHOOK_PATTERN } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../config/config.module';
import type { notificationChannels } from '../db/schema';
import { sign, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '../ingestion/webhook-signature';
import { SecretStore } from '../secrets/secret-store.service';
import { slackMessage, webhookPayload, type Notification } from './messages';
import { checkOutboundUrl, UnsafeUrlError } from './outbound-url';

export type ChannelRow = typeof notificationChannels.$inferSelect;

export interface SendResult {
  ok: boolean;
  status: number | null;
  error: string | null;
  /** A permanent failure (bad URL, 4xx) is not retried; network errors and 5xx/429 are. */
  permanent: boolean;
}

const TIMEOUT_MS = 5000;
export const EVENT_HEADER = 'x-ape-event';

const fail = (error: string, permanent: boolean, status: number | null = null): SendResult => ({
  ok: false,
  status,
  error: error.slice(0, 500),
  permanent,
});

/** The destination URL: a Slack webhook is the stored secret, a generic webhook keeps its URL. */
function destinationOf(channel: ChannelRow, secret: string | undefined): string | SendResult {
  const target = channel.kind === 'slack' ? secret : channel.url;
  if (!target) return fail('Channel is missing its URL or secret', true);
  if (channel.kind === 'slack' && !SLACK_WEBHOOK_PATTERN.test(target))
    return fail('Not a Slack incoming webhook URL', true);
  return target;
}

/** The JSON body and headers; generic webhooks are signed with the channel's secret. */
function requestFor(
  channel: ChannelRow,
  n: Notification,
  secret: string | undefined,
): { body: string; headers: Record<string, string> } | SendResult {
  const body = JSON.stringify(channel.kind === 'slack' ? slackMessage(n) : webhookPayload(n));
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'ai-production-engineer-notifications',
  };
  if (channel.kind === 'webhook') {
    if (!secret) return fail('Channel is missing its signing secret', true);
    const ts = String(Math.floor(Date.now() / 1000));
    headers[TIMESTAMP_HEADER] = ts;
    headers[SIGNATURE_HEADER] = sign(secret, ts, body);
    headers[EVENT_HEADER] = n.type;
  }
  return { body, headers };
}

function resultOf(status: number): SendResult {
  if (status >= 200 && status < 300) return { ok: true, status, error: null, permanent: false };
  if (status >= 300 && status < 400)
    return fail(`Receiver redirected (${status}); redirects are not followed`, true, status);
  const retryable = status >= 500 || status === 429 || status === 408;
  return fail(`Receiver responded ${status}`, !retryable, status);
}

const isFailure = (v: unknown): v is SendResult => typeof v === 'object' && v !== null && 'ok' in v;

/** Posts one notification to one channel. Never follows redirects (SSRF, ADR-020). */
@Injectable()
export class NotificationSender {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
  ) {}

  async send(channel: ChannelRow, n: Notification): Promise<SendResult> {
    const secret = channel.secretReference
      ? await this.secrets.get(channel.workspaceId, channel.secretReference)
      : undefined;
    const target = destinationOf(channel, secret);
    if (isFailure(target)) return target;

    let url: URL;
    try {
      url = await checkOutboundUrl(target, { allowPrivate: this.env.NODE_ENV !== 'production' });
    } catch (err) {
      if (err instanceof UnsafeUrlError) return fail(err.message, true);
      return fail(`Could not resolve the webhook host: ${(err as Error).message}`, false);
    }

    const request = requestFor(channel, n, secret);
    if (isFailure(request)) return request;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        body: request.body,
        headers: request.headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const e = err as Error;
      return fail(
        e.name === 'TimeoutError' ? `Timed out after ${TIMEOUT_MS} ms` : e.message,
        false,
      );
    }
    await res.body?.cancel().catch(() => undefined);
    return resultOf(res.status);
  }
}
