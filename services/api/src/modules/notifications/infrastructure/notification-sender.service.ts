import { Inject, Injectable } from '@nestjs/common';
import { SLACK_WEBHOOK_PATTERN, type DeliveryChannel } from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { notificationChannels } from '../../../core/db/schema';
import {
  sign,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '../../../ingest/ingestion/domain/webhook-signature';
import { SecretStore } from '../../../core/secrets/secret-store.service';
import { Mailer, retryAfterMs, type MailOutcome } from '../../auth/infrastructure/mailer.service';
import {
  emailMessage,
  headline,
  slackMessage,
  teamsMessage,
  webhookPayload,
  type Notification,
} from '../domain/messages';
import type { SendOutcome } from '../domain/delivery-state';
import { checkOutboundUrl, UnsafeUrlError } from '../../../core/common/outbound-url';

export type ChannelRow = typeof notificationChannels.$inferSelect;

export interface Destination {
  attemptId: string;
  channel: DeliveryChannel;
  address: string;
  workspaceId: string;
  secretReference: string | null;
}

const TIMEOUT_MS = 5000;
export const EVENT_HEADER = 'x-ape-event';
export const ATTEMPT_HEADER = 'x-ape-delivery';
export const TWILIO_STATUS_PATH = '/notifications/twilio/status';

const plainText = (n: Notification) => `${headline(n)}: ${n.incident.title}`.slice(0, 300);
const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, '').slice(0, 200);
const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const permanent = (error: string, status: number | null = null): SendOutcome => ({
  kind: 'permanent',
  error: error.slice(0, 500),
  status,
});

function outcomeOf(res: Response, providerMessageId: string | null = null): SendOutcome {
  const status = res.status;
  if (status >= 200 && status < 300)
    return providerMessageId
      ? { kind: 'accepted', providerMessageId, status }
      : { kind: 'delivered', status };
  if (status >= 300 && status < 400)
    return permanent(`Receiver redirected (${status}); redirects are not followed`, status);
  if (status >= 500 || status === 429 || status === 408)
    return {
      kind: 'transient',
      error: `Receiver responded ${status}`,
      status,
      retryAfterMs: retryAfterMs(res.headers.get('retry-after')),
    };
  return permanent(`Receiver responded ${status}`, status);
}

function networkFailure(err: unknown): SendOutcome {
  const e = err as Error;
  if (e.name === 'TimeoutError')
    return { kind: 'timeout', error: `Timed out after ${TIMEOUT_MS} ms` };
  return { kind: 'transient', error: e.message.slice(0, 500), status: null, retryAfterMs: null };
}

export function mailOutcome(outcome: MailOutcome): SendOutcome {
  if (outcome.state === 'accepted')
    return { kind: 'accepted', providerMessageId: outcome.providerMessageId, status: null };
  if (outcome.state === 'not_configured')
    return permanent(
      'E-mail is not configured on this deployment (set SMTP_URL or RESEND_API_KEY)',
    );
  return outcome.transient
    ? { kind: 'transient', error: outcome.error, status: null, retryAfterMs: outcome.retryAfterMs }
    : permanent(outcome.error);
}

@Injectable()
export class NotificationSender {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly secrets: SecretStore,
    private readonly mailer: Mailer,
  ) {}

  get twilioConfigured(): boolean {
    return Boolean(
      this.env.TWILIO_ACCOUNT_SID && this.env.TWILIO_AUTH_TOKEN && this.env.TWILIO_FROM,
    );
  }

  get emailConfigured(): boolean {
    return this.mailer.isConfigured;
  }

  async send(dest: Destination, n: Notification): Promise<SendOutcome> {
    if (dest.channel === 'email') {
      const mail = emailMessage(n);
      return mailOutcome(
        await this.mailer.send({ to: dest.address, ...mail, idempotencyKey: dest.attemptId }),
      );
    }
    if (dest.channel === 'sms' || dest.channel === 'call') return this.sendTwilio(dest, n);
    return this.sendHttp(dest, n);
  }

  private async sendTwilio(dest: Destination, n: Notification): Promise<SendOutcome> {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = this.env;
    if (!sid || !token || !from)
      return permanent('SMS and phone calls are not configured on this deployment (Twilio)');
    const call = dest.channel === 'call';
    const form = new URLSearchParams({
      To: dest.address,
      From: from,
      StatusCallback: `${this.env.PUBLIC_API_URL}${TWILIO_STATUS_PATH}`,
    });
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
      return networkFailure(err);
    }
    const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    const outcome = outcomeOf(res, body.sid ?? null);
    if (outcome.kind === 'delivered')
      return { kind: 'accepted', providerMessageId: null, status: res.status };
    if (outcome.kind === 'permanent' && body.message)
      return permanent(`${outcome.error}: ${body.message}`, res.status);
    return outcome;
  }

  private async resolveUrl(
    dest: Destination,
    secret: string | undefined,
  ): Promise<URL | SendOutcome> {
    const target = dest.channel === 'slack' ? secret : dest.address;
    if (!target) return permanent('Channel is missing its URL or secret');
    if (dest.channel === 'slack' && !SLACK_WEBHOOK_PATTERN.test(target))
      return permanent('Not a Slack incoming webhook URL');
    try {
      return await checkOutboundUrl(target, { allowPrivate: this.env.NODE_ENV !== 'production' });
    } catch (err) {
      if (err instanceof UnsafeUrlError) return permanent(err.message);
      return {
        kind: 'transient',
        error: `Could not resolve the host: ${(err as Error).message}`,
        status: null,
        retryAfterMs: null,
      };
    }
  }

  private requestFor(
    dest: Destination,
    n: Notification,
    secret: string | undefined,
  ): { body: string; headers: Record<string, string> } | SendOutcome {
    const headers: Record<string, string> = {
      'user-agent': 'pramaan-notifications',
      [ATTEMPT_HEADER]: dest.attemptId,
    };
    if (dest.channel === 'push') {
      const urgent = n.incident.severity === 'critical' || n.incident.severity === 'high';
      return {
        body: plainText(n),
        headers: {
          ...headers,
          Title: ascii(headline(n)),
          Priority: urgent ? '4' : '3',
          Click: n.url,
          Tags: urgent ? 'rotating_light' : 'warning',
        },
      };
    }
    const payload =
      dest.channel === 'slack'
        ? slackMessage(n)
        : dest.channel === 'teams'
          ? teamsMessage(n)
          : webhookPayload(n);
    const body = JSON.stringify(payload);
    headers['content-type'] = 'application/json';
    if (dest.channel === 'webhook') {
      if (!secret) return permanent('Channel is missing its signing secret');
      const ts = String(Math.floor(Date.now() / 1000));
      headers[TIMESTAMP_HEADER] = ts;
      headers[SIGNATURE_HEADER] = sign(secret, ts, body);
      headers[EVENT_HEADER] = n.type;
    }
    return { body, headers };
  }

  private async sendHttp(dest: Destination, n: Notification): Promise<SendOutcome> {
    const secret = dest.secretReference
      ? await this.secrets.get(dest.workspaceId, dest.secretReference)
      : undefined;
    const url = await this.resolveUrl(dest, secret);
    if (!(url instanceof URL)) return url;
    const request = this.requestFor(dest, n, secret);
    if ('kind' in request) return request;
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
      return networkFailure(err);
    }
    if (dest.channel === 'push') {
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return outcomeOf(res, body.id ?? null);
    }
    await res.body?.cancel().catch(() => undefined);
    return outcomeOf(res);
  }
}
