import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { AuditService } from '../../../core/audit/audit.service';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { sessions } from '../../../core/db/schema';
import { InvitationService } from './invitation.service';

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

  async create(userId: string, correlationId: string, method: string): Promise<string> {
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
    return this.jwt.signAsync(
      { sub: userId, sid: session!.id },
      { expiresIn: Math.floor(this.ttlMs / 1000) },
    );
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
