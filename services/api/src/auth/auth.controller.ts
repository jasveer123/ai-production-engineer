import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { devLoginSchema, type DevLoginInput, type Me } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { notFound, unauthorized } from '../common/errors';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github-oauth.service';
import { Public } from './public.decorator';
import { SESSION_COOKIE } from './session.guard';

const STATE_COOKIE = 'ape_oauth_state';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly github: GitHubOAuthService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    };
  }

  @Public()
  @Get('providers')
  providers(): Me['authProviders'] {
    return this.auth.providers();
  }

  /** Local-only login for seeded/dev users. Returns 404 unless AUTH_DEV_LOGIN=true. */
  @Public()
  @Post('dev-login')
  @HttpCode(204)
  async devLogin(
    @Body(new ZodValidationPipe(devLoginSchema)) body: DevLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (!this.env.AUTH_DEV_LOGIN) throw notFound('Route');
    const userId = await this.auth.upsertUser({
      provider: 'dev',
      providerId: body.email.toLowerCase(),
      email: body.email,
      name: null,
      avatarUrl: null,
    });
    const token = await this.auth.createSession(userId, req.correlationId, 'dev');
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(this.auth.sessionTtlMs));
  }

  @Public()
  @Get('github')
  githubStart(@Res() res: Response): void {
    if (!this.auth.providers().github) throw notFound('GitHub login is not configured');
    const state = randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, this.cookieOptions(10 * 60 * 1000));
    res.redirect(this.github.authorizeUrl(state));
  }

  @Public()
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const expected = (req.cookies as Record<string, string> | undefined)?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });
    const stateOk =
      !!state &&
      !!expected &&
      state.length === expected.length &&
      timingSafeEqual(Buffer.from(state), Buffer.from(expected));
    if (!code || !stateOk) {
      await this.audit.record({
        action: 'auth.login',
        resourceType: 'session',
        outcome: 'denied',
        correlationId: req.correlationId,
        metadata: { method: 'github', reason: 'invalid_state' },
      });
      throw unauthorized();
    }

    try {
      const profile = await this.github.exchangeCode(code);
      const userId = await this.auth.upsertUser(profile);
      const token = await this.auth.createSession(userId, req.correlationId, 'github');
      res.cookie(SESSION_COOKIE, token, this.cookieOptions(this.auth.sessionTtlMs));
      res.redirect(this.env.WEB_URL);
    } catch (err) {
      await this.audit.record({
        action: 'auth.login',
        resourceType: 'session',
        outcome: 'failure',
        correlationId: req.correlationId,
        metadata: { method: 'github', reason: (err as Error).message },
      });
      res.redirect(`${this.env.WEB_URL}/login?error=github`);
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.revokeSession(req.auth!.userId, req.auth!.sessionId, req.correlationId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@Req() req: Request): Promise<Me> {
    return this.auth.me(req.auth!.userId, req.correlationId);
  }
}
