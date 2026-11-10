import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { AuditService } from '../../../core/audit/audit.service';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { sessions } from '../../../core/db/schema';
import { InvitationService } from './invitation.service';
import { unauthorized } from '../../../core/common/errors';

export interface SessionTokens {
  access: string;
  refresh: string;
}

interface TokenPayload {
  sub: string;
  sid: string;
  typ?: 'access' | 'refresh';
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly invitations: InvitationService,
  ) {}

  get ttlMs(): number {
    return this.env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  get accessTtlMs(): number {
    return this.env.ACCESS_TTL_MINUTES * 60 * 1000;
  }

  private async issueTokens(userId: string, sessionId: string): Promise<SessionTokens> {
    const [access, refresh] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, sid: sessionId, typ: 'access' },
        { expiresIn: Math.floor(this.accessTtlMs / 1000) },
      ),
      this.jwt.signAsync(
        { sub: userId, sid: sessionId, typ: 'refresh' },
        { expiresIn: Math.floor(this.ttlMs / 1000) },
      ),
    ]);
    return { access, refresh };
  }

  async refresh(refreshToken: string): Promise<{ userId: string; tokens: SessionTokens }> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken);
    } catch {
      throw unauthorized();
    }
    if (payload.typ !== 'refresh') throw unauthorized();

    const [session] = await this.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + this.ttlMs) })
      .where(
        and(
          eq(sessions.id, payload.sid),
          eq(sessions.userId, payload.sub),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: sessions.id });
    if (!session) throw unauthorized();

    return { userId: payload.sub, tokens: await this.issueTokens(payload.sub, session.id) };
  }

  async create(userId: string, correlationId: string, method: string): Promise<SessionTokens> {
    const [session] = await this.db
      .insert(sessions)
      .values({ userId, expiresAt: new Date(Date.now() + this.ttlMs) })
      .returning({ id: sessions.id });
    await this.invitations.acceptPending(userId, correlationId);
    await this.audit.record({
      actorId: userId,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: session!.id,
      outcome: 'success',
      correlationId,
      metadata: { method },
    });
    return this.issueTokens(userId, session!.id);
  }

  async revoke(userId: string, sessionId: string, correlationId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    await this.audit.record({
      actorId: userId,
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: sessionId,
      outcome: 'success',
      correlationId,
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async revokeOthers(userId: string, keepSessionId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, keepSessionId),
          isNull(sessions.revokedAt),
        ),
      );
  }
}
