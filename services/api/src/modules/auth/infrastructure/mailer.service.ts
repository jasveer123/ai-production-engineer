import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { ENV, type ApiEnv } from '../../../core/config/config.module';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class Mailer {
  private readonly logger = new Logger(Mailer.name);
  private readonly smtp?: Transporter;

  readonly sent: Mail[] = [];

  constructor(@Inject(ENV) private readonly env: ApiEnv) {
    if (env.SMTP_URL) this.smtp = createTransport(env.SMTP_URL);
  }

  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
    if (this.sent.length > 50) this.sent.shift();
    if (this.smtp) return this.sendSmtp(mail);
    if (this.env.RESEND_API_KEY) return this.sendResend(mail, this.env.RESEND_API_KEY);
    this.logger.log(`[mail to ${mail.to}] ${mail.subject}\n${mail.text}`);
  }

  private async sendSmtp(mail: Mail): Promise<void> {
    try {
      await this.smtp!.sendMail({
        from: this.env.MAIL_FROM,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
    } catch (err) {
      this.logger.error(`Email to ${mail.to} failed: ${(err as Error).message}`);
    }
  }

  private async sendResend(mail: Mail, apiKey: string): Promise<void> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
      this.logger.error(`Email to ${mail.to} failed: ${(err as Error).message}`);
    }
  }
}
