import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { authTokens } from '../../../core/db/schema';
import { badLink } from '../auth-errors';
import { Mailer } from '../infrastructure/mailer.service';
import { newLinkToken, sha256 } from '../domain/password';

const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class AccountLinks {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly mailer: Mailer,
  ) {}

  async issue(userId: string, kind: string, ttlMs: number): Promise<string> {
    const token = newLinkToken();
    await this.db.insert(authTokens).values({
      userId,
      kind,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  async consume(token: string, kind: string): Promise<string> {
    const [row] = await this.db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          eq(authTokens.kind, kind),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: authTokens.userId });
    if (!row) throw badLink();
    return row.userId;
  }

  async sendVerification(userId: string, email: string): Promise<void> {
    const token = await this.issue(userId, 'email_verify', VERIFY_TTL_MS);
    await this.mailer.send({
      to: email,
      subject: 'Confirm your email',
      text: [
        'Confirm the email for your AI Production Engineer account:',
        `${this.env.WEB_URL}/verify-email/?token=${token}`,
        'The link expires in 48 hours.',
      ].join('\n\n'),
    });
  }

  async sendPasswordReset(userId: string, email: string): Promise<void> {
    const token = await this.issue(userId, 'password_reset', RESET_TTL_MS);
    await this.mailer.send({
      to: email,
      subject: 'Reset your password',
      text: [
        'Someone asked to reset the password for your AI Production Engineer account.',
        `Set a new password: ${this.env.WEB_URL}/reset-password/?token=${token}`,
        'The link works once and expires in 30 minutes. If this was not you, ignore this email.',
      ].join('\n\n'),
    });
  }
}
