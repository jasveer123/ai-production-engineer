import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type ApiEnv } from '../../../core/config/config.module';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
}

export type MailOutcome =
  | { state: 'accepted'; providerMessageId: string | null }
  | { state: 'failed'; transient: boolean; error: string; retryAfterMs: number | null }
  | { state: 'not_configured' };

const TIMEOUT_MS = 10_000;
const TRANSIENT_SOCKET_CODES = new Set([
  'ECONNECTION',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKET',
  'EDNS',
  'EAI_AGAIN',
]);

const failed = (error: string, transient: boolean, retryAfterMs: number | null = null) =>
  ({ state: 'failed', transient, error: error.slice(0, 500), retryAfterMs }) as const;

export function smtpFailure(err: unknown): MailOutcome {
  const e = err as { message?: string; responseCode?: number; code?: string };
  const message = e.message ?? 'SMTP error';
  if (typeof e.responseCode === 'number') return failed(message, e.responseCode < 500);
  return failed(message, TRANSIENT_SOCKET_CODES.has(e.code ?? '') || !e.code);
}

export function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly smtp?: Transporter;

  /** Last mails handed to the mailer, whatever the outcome; tests read it. */
  readonly sent: Mail[] = [];

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    if (env.SMTP_URL) this.smtp = createTransport(env.SMTP_URL);
  }

  get isConfigured(): boolean {
    return Boolean(this.smtp || this.env.RESEND_API_KEY);
  }

  async send(mail: Mail): Promise<MailOutcome> {
    this.sent.push(mail);
    if (this.sent.length > 50) this.sent.shift();
    const outcome = this.smtp
      ? await this.sendSmtp(this.smtp, mail)
      : this.env.RESEND_API_KEY
        ? await this.sendResend(mail, this.env.RESEND_API_KEY)
        : ({ state: 'not_configured' } as const);
    if (outcome.state === 'failed')
      this.logger.error(`Email to ${mail.to} failed: ${outcome.error}`);
    if (outcome.state === 'not_configured')
      this.logger.warn(`Email is not configured; not sent to ${mail.to}: ${mail.subject}`);
    return outcome;
  }

  private async sendSmtp(smtp: Transporter, mail: Mail): Promise<MailOutcome> {
    try {
      const info = (await smtp.sendMail({
        from: this.env.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      })) as { messageId?: string; rejected?: unknown[] };
      if (info.rejected?.length) return failed(`Recipient ${mail.to} was rejected`, false);
      return { state: 'accepted', providerMessageId: info.messageId ?? null };
    } catch (err) {
      return smtpFailure(err);
    }
  }

  private async sendResend(mail: Mail, apiKey: string): Promise<MailOutcome> {
    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(mail.idempotencyKey ? { 'Idempotency-Key': mail.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: this.env.MAIL_FROM,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      return failed((err as Error).message, true);
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok) return { state: 'accepted', providerMessageId: body.id ?? null };
    const transient = res.status === 429 || res.status === 408 || res.status >= 500;
    return failed(
      `Resend responded ${res.status}${body.message ? `: ${body.message}` : ''}`,
      transient,
      retryAfterMs(res.headers.get('retry-after')),
    );
  }
}
