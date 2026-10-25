import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ApiEnv } from '../config/config.module';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends account emails. With RESEND_API_KEY set it uses the Resend HTTP API; otherwise it logs the
 * message (including the link) to the API console, which is the local development setup.
 */
@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  /** The last messages, for tests and local debugging. */
  readonly sent: Mail[] = [];

  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    if (this.sent.length > 50) this.sent.shift();
    if (!this.env.RESEND_API_KEY) {
      this.logger.log(`[mail to ${mail.to}] ${mail.subject}\n${mail.text}`);
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.env.MAIL_FROM,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) this.logger.error(`Email to ${mail.to} failed: HTTP ${res.status}`);
    } catch (err) {
      // Account flows must not fail because email is down; the user can ask for the link again.
      this.logger.error(`Email to ${mail.to} failed: ${(err as Error).message}`);
    }
  }
}
