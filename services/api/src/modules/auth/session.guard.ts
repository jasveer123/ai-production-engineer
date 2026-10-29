import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { trace } from '@opentelemetry/api';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { unauthorized } from '../../core/common/errors';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { sessions } from '../../core/db/schema';
import { IS_PUBLIC_KEY } from './public.decorator';

export const SESSION_COOKIE = 'ape_session';

interface SessionToken {
  sub: string;
  sid: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (!token) throw unauthorized();

    let payload: SessionToken;
    try {
      payload = await this.jwt.verifyAsync<SessionToken>(token);
    } catch {
      throw unauthorized();
    }

    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.id, payload.sid),
          eq(sessions.userId, payload.sub),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!session) throw unauthorized();

    req.auth = { userId: payload.sub, sessionId: payload.sid };
    trace.getActiveSpan()?.setAttribute('user_id', payload.sub);
    return true;
  }
}
