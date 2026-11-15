import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { trace } from '@opentelemetry/api';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { forbidden, unauthorized } from '../../core/common/errors';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { sessions } from '../../core/db/schema';
import { ApiTokensService } from './application/api-tokens.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export const SESSION_COOKIE = 'ape_session';
export const REFRESH_COOKIE = 'ape_refresh';
export const REFRESH_COOKIE_PATH = '/auth';

interface SessionToken {
  sub: string;
  sid: string;
  typ?: 'access' | 'refresh';
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly apiTokens: ApiTokensService,
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
    if (!token) return this.fromApiToken(req);

    let payload: SessionToken;
    try {
      payload = await this.jwt.verifyAsync<SessionToken>(token);
    } catch {
      throw unauthorized();
    }

    if (payload.typ === 'refresh') throw unauthorized();

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

  private async fromApiToken(req: Request): Promise<boolean> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '')?.[1];
    const pat = bearer ? await this.apiTokens.resolve(bearer) : null;
    if (!pat) throw unauthorized();
    const routePath = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const meOnly = req.method === 'GET' && routePath === '/auth/me';
    if (pat.grant.workspaceId && !routePath.includes(':workspaceId') && !meOnly)
      throw forbidden('This API token only works on its workspace routes');
    req.auth = { userId: pat.userId, sessionId: `pat:${pat.grant.id}`, token: pat.grant };
    trace.getActiveSpan()?.setAttribute('user_id', pat.userId);
    return true;
  }
}
