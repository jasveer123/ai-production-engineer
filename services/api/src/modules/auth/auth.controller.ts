import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  resendVerificationSchema,
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
  type ResendVerificationInput,
  type ResetPasswordInput,
  type TokenInput,
  type UpdateProfileInput,
} from '@ape/api-contracts';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { notFound, unauthorized } from '../../core/common/errors';
import { ZodValidationPipe } from '../../core/common/zod-validation.pipe';
import { AccountService } from './application/account.service';
import { AuthService } from './auth.service';
import { OAuthProviders, type OAuthProvider } from './infrastructure/oauth-providers.service';
import { Public } from './public.decorator';
import { RateLimiter } from './rate-limit';
import { SessionService, type SessionTokens } from './application/session.service';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, SESSION_COOKIE } from './session.guard';

const STATE_COOKIE = 'ape_oauth_state';

const authLimiter = new RateLimiter(20, 60_000);
const refreshLimiter = new RateLimiter(60, 60_000);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly account: AccountService,
    private readonly oauth: OAuthProviders,
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

  private signIn(res: Response, tokens: SessionTokens): void {
    res.cookie(SESSION_COOKIE, tokens.access, this.cookieOptions(this.sessions.accessTtlMs));
    res.cookie(REFRESH_COOKIE, tokens.refresh, {
      ...this.cookieOptions(this.sessions.ttlMs),
      path: REFRESH_COOKIE_PATH,
    });
  }

  private signOut(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private oauthStart(provider: OAuthProvider, res: Response): void {
    if (!this.account.providers()[provider]) {
      throw notFound(`${provider === 'github' ? 'GitHub' : 'Slack'} login is not configured`);
    }
    const state = randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, this.cookieOptions(10 * 60 * 1000));
    res.redirect(this.oauth.flow(provider).authorizeUrl(state));
  }

  private async oauthCallback(
    provider: OAuthProvider,
    code: string | undefined,
    state: string | undefined,
    req: Request,
    res: Response,
  ): Promise<void> {
    const expected = (req.cookies as Record<string, string> | undefined)?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/' });
    const stateOk =
      !!state &&
      !!expected &&
      state.length === expected.length &&
      timingSafeEqual(Buffer.from(state), Buffer.from(expected));
    if (!code || !stateOk) {
      await this.auth.recordLoginFailure(req.correlationId, provider, 'denied', 'invalid_state');
      throw unauthorized();
    }

    try {
      const profile = await this.oauth.flow(provider).exchangeCode(code);
      const userId = await this.auth.upsertUser(profile);
      this.signIn(res, await this.sessions.create(userId, req.correlationId, provider));
      res.redirect(this.env.WEB_URL);
    } catch (err) {
      await this.auth.recordLoginFailure(
        req.correlationId,
        provider,
        'failure',
        (err as Error).message,
      );
      res.redirect(`${this.env.WEB_URL}/login?error=${provider}`);
    }
  }

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me | null> {
    authLimiter.check(`register:${req.ip}`);
    const { userId, verified } = await this.auth.register(body, req.correlationId);
    if (!verified) {
      if (body.workspaceName) {
        await this.account.createFirstWorkspace(userId, body.workspaceName, req.correlationId);
      }
      res.status(HttpStatus.ACCEPTED);
      return null;
    }
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
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodValidationPipe(tokenSchema)) body: TokenInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Me> {
    authLimiter.check(`verify:${req.ip}`);
    const userId = await this.auth.verifyEmail(body.token, req.correlationId);
    this.signIn(res, await this.sessions.create(userId, req.correlationId, 'email_verify'));
    return this.account.me(userId, req.correlationId);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(204)
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema)) body: ResendVerificationInput,
    @Req() req: Request,
  ): Promise<void> {
    authLimiter.check(`resend:${req.ip}`);
    authLimiter.check(`resend:${body.email}`);
    await this.auth.resendVerification(body.email);
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
    this.oauthStart('github', res);
  }

  @Public()
  @Get('github/callback')
  githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.oauthCallback('github', code, state, req, res);
  }

  @Public()
  @Get('slack')
  slackStart(@Res() res: Response): void {
    this.oauthStart('slack', res);
  }

  @Public()
  @Get('slack/callback')
  slackCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.oauthCallback('slack', code, state, req, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Me> {
    refreshLimiter.check(`refresh:${req.ip}`);
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!token) throw unauthorized();
    try {
      const { userId, tokens } = await this.sessions.refresh(token);
      this.signIn(res, tokens);
      return await this.account.me(userId, req.correlationId);
    } catch (err) {
      this.signOut(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(req.auth!.userId, req.auth!.sessionId, req.correlationId);
    this.signOut(res);
  }

  @Get('me')
  me(@Req() req: Request): Promise<Me> {
    return this.account.me(req.auth!.userId, req.correlationId);
  }
}
