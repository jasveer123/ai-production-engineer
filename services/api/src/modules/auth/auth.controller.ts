import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import {
  changePasswordSchema,
  devLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type DevLoginInput,
  type ForgotPasswordInput,
  type InvitationPreview,
  type LoginInput,
  type Me,
  type RegisterInput,
  type ResetPasswordInput,
  type TokenInput,
  type UpdateProfileInput,
} from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { notFound, unauthorized } from '../../core/common/errors';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { AccountService } from './application/account.service';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './infrastructure/github-oauth.service';
import { Public } from './public.decorator';
import { RateLimiter } from './rate-limit';
import { SessionService } from './application/session.service';
import { SESSION_COOKIE } from './session.guard';

const STATE_COOKIE = 'ape_oauth_state';

const authLimiter = new RateLimiter(20, 60_000);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly account: AccountService,
    private readonly github: GitHubOAuthService,
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
    return this.account.providers();
  }

  private signIn(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, this.cookieOptions(this.sessions.ttlMs));
  }

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    authLimiter.check(`register:${req.ip}`);
    const userId = await this.auth.register(body, req.correlationId);
    this.signIn(res, await this.sessions.create(userId, req.correlationId, 'password'));
    return this.account.me(userId, req.correlationId);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    authLimiter.check(`login:${req.ip}`);
    const userId = await this.auth.login(body, req.correlationId, req.ip);
    this.signIn(res, await this.sessions.create(userId, req.correlationId, 'password'));
    return this.account.me(userId, req.correlationId);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(204)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: ForgotPasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    authLimiter.check(`forgot:${req.ip}`);
    await this.auth.forgotPassword(body.email, req.correlationId);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    authLimiter.check(`reset:${req.ip}`);
    const userId = await this.auth.resetPassword(body.token, body.password, req.correlationId);
    this.signIn(res, await this.sessions.create(userId, req.correlationId, 'password_reset'));
    return this.account.me(userId, req.correlationId);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(204)
  async verifyEmail(
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenInput,
    @Req() req: Request,
  ): Promise<void> {
    authLimiter.check(`verify:${req.ip}`);
    await this.auth.verifyEmail(body.token, req.correlationId);
  }

  @Post('resend-verification')
  @HttpCode(204)
  async resendVerification(@Req() req: Request): Promise<void> {
    authLimiter.check(`resend:${req.auth!.userId}`);
    await this.auth.resendVerification(req.auth!.userId);
  }

  @Post('change-password')
  @HttpCode(204)
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    authLimiter.check(`change:${req.auth!.userId}`);
    return this.auth.changePassword(req.auth!.userId, req.auth!.sessionId, body, req.correlationId);
  }

  @Patch('me')
  async updateProfile(
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @Req() req: Request,
  ): Promise<Me> {
    await this.account.updateProfile(req.auth!.userId, body.name);
    return this.account.me(req.auth!.userId, req.correlationId);
  }

  @Public()
  @Get('invitations/:token')
  invitation(@Param('token') token: string, @Req() req: Request): Promise<InvitationPreview> {
    authLimiter.check(`invite:${req.ip}`);
    return this.account.invitationPreview(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  async acceptInvitation(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<{ workspaceId: string }> {
    const workspaceId = await this.account.acceptInvitation(
      req.auth!.userId,
      token,
      req.correlationId,
    );
    return { workspaceId };
  }

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
    this.signIn(res, await this.sessions.create(userId, req.correlationId, 'dev'));
  }

  @Public()
  @Get('github')
  githubStart(@Res() res: Response): void {
    if (!this.account.providers().github) throw notFound('GitHub login is not configured');
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
      await this.auth.recordLoginFailure(req.correlationId, 'github', 'denied', 'invalid_state');
      throw unauthorized();
    }

    try {
      const profile = await this.github.exchangeCode(code);
      const userId = await this.auth.upsertUser(profile);
      const token = await this.sessions.create(userId, req.correlationId, 'github');
      res.cookie(SESSION_COOKIE, token, this.cookieOptions(this.sessions.ttlMs));
      res.redirect(this.env.WEB_URL);
    } catch (err) {
      await this.auth.recordLoginFailure(
        req.correlationId,
        'github',
        'failure',
        (err as Error).message,
      );
      res.redirect(`${this.env.WEB_URL}/login?error=github`);
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(req.auth!.userId, req.auth!.sessionId, req.correlationId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@Req() req: Request): Promise<Me> {
    return this.account.me(req.auth!.userId, req.correlationId);
  }
}
