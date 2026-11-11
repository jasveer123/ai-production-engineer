import { Inject, Injectable } from '@nestjs/common';
import { SLACK_WEBHOOK_PATTERN } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { notificationChannels } from '../../../core/db/schema';
import {
  sign,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '../../../ingest/ingestion/domain/webhook-signature';
import { SecretStore } from '../../../core/secrets/secret-store.service';
import { headline, slackMessage, webhookPayload, type Notification } from '../domain/messages';
import { checkOutboundUrl, UnsafeUrlError } from '../../../core/common/outbound-url';

export type ChannelRow = typeof notificationChannels.$inferSelect;

export interface SendResult {
  ok: boolean;
  status: number | null;
  error: string | null;

  permanent: boolean;
}

const TIMEOUT_MS = 5000;
export const EVENT_HEADER = 'x-ape-event';

const plainText = (n: Notification) => `${headline(n)}: ${n.incident.title}`.slice(0, 300);
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, '').slice(0, 200);
const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fail = (error: string, permanent: boolean, status: number | null = null): SendResult => ({
  ok: false,
  status,
  error: error.slice(0, 500),
  permanent,
});

function destinationOf(channel: ChannelRow, secret: string | undefined): string | SendResult {
  const target = channel.kind === 'slack' ? secret : channel.url;
  if (!target) return fail('Channel is missing its URL or secret', true);
  if (channel.kind === 'slack' && !SLACK_WEBHOOK_PATTERN.test(target))
    return fail('Not a Slack incoming webhook URL', true);
  return target;
}

function requestFor(
  channel: ChannelRow,
  n: Notification,
  secret: string | undefined,
): { body: string; headers: Record<string, string> } | SendResult {
  if (channel.kind === 'push') {
    const urgent = n.incident.severity === 'critical' || n.incident.severity === 'high';
    return {
      body: plainText(n),
      headers: {
        'user-agent': 'ai-production-engineer-notifications',
        Title: ascii(headline(n)),
        Priority: urgent ? '4' : '3',
        Click: n.url,
        Tags: urgent ? 'rotating_light' : 'warning',
      },
    };
  }
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

@Injectable()
export class NotificationSender {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
  ) {}

  private async sendTwilio(channel: ChannelRow, n: Notification): Promise<SendResult> {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = this.env;
    if (!sid || !token || !from)
      return fail('SMS and phone alerts are not set up on this deployment', true);
    const call = channel.kind === 'phone';
    const form = new URLSearchParams({ To: channel.url ?? '', From: from });
    if (call) form.set('Twiml', `<Response><Say>${xml(plainText(n))}</Say></Response>`);
    else form.set('Body', plainText(n));
    let res: Response;
    try {
      res = await fetch(
        `${this.env.TWILIO_API_URL}/2010-04-01/Accounts/${sid}/${call ? 'Calls' : 'Messages'}.json`,
        {
          method: 'POST',
          body: form,
          headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` },
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (err) {
      return fail((err as Error).message, false);
    }
    await res.body?.cancel().catch(() => undefined);
    return resultOf(res.status);
  }

  async send(channel: ChannelRow, n: Notification): Promise<SendResult> {
    if (channel.kind === 'sms' || channel.kind === 'phone') return this.sendTwilio(channel, n);
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
