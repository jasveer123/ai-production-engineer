import { HttpStatus, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { OAuthCallbackInput, OAuthCallbackResult } from '@ape/api-contracts';
import { ApiException } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { ENV, type ApiEnv } from '../config/config.module';
import { ToolsService } from '../tools/tools.service';
import {
  herokuAuthorizeUrl,
  herokuExchange,
  sentryExchange,
  sentryInstallUrl,
  sentryVerifyInstall,
  vercelExchange,
  vercelInstallUrl,
} from './oauth';
import { OAuthStateService } from './oauth-state.service';
import { listHerokuApps, ProvisionError } from './provisioners';
import {
  callbackUrl,
  herokuConfigured,
  sentryConfig,
  sentryConfigured,
  trimSlash,
  vercelConfigured,
} from './setup-config';
import { SetupSupport, setupFailed } from './setup-support.service';
import { ToolSetupService } from './setup-tools.service';

export type OAuthProvider = 'sentry' | 'vercel' | 'heroku';

/** Sign in with Sentry, Vercel or Heroku instead of pasting a key. */
@Injectable()
export class OAuthSetupService implements OnModuleInit {
  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly state: OAuthStateService,
    private readonly tools: ToolsService,
    private readonly support: SetupSupport,
    private readonly toolSetup: ToolSetupService,
  ) {}

  onModuleInit(): void {
    // Sentry app tokens expire every 8 hours; refresh them before the AI reads Sentry.
    this.tools.refreshers.set('sentry', async (settings, secrets) => {
      if (settings.auth !== 'app' || !secrets.refreshToken || !sentryConfigured(this.env))
        return null;
      if (Date.parse(secrets.expiresAt ?? '') - Date.now() > 10 * 60_000) return null;
      const t = await sentryExchange(
        sentryConfig(this.env),
        settings.installationId!,
        { grant_type: 'refresh_token', refresh_token: secrets.refreshToken },
        this.support.fetchFn,
      );
      return { token: t.token, refreshToken: t.refreshToken, expiresAt: t.expiresAt };
    });
  }

  /** Which providers this server has OAuth credentials for. */
  configured(): Record<OAuthProvider, boolean> {
    return {
      sentry: sentryConfigured(this.env),
      vercel: vercelConfigured(this.env),
      heroku: herokuConfigured(this.env),
    };
  }

  async oauthStart(actor: ActorContext, provider: OAuthProvider): Promise<string> {
    if (!this.configured()[provider])
      throw new ApiException(
        HttpStatus.CONFLICT,
        'not_configured',
        `${provider} sign-in is not configured on this server`,
      );
    const state = await this.state.issue(actor, provider);
    if (provider === 'sentry')
      return sentryInstallUrl(this.env.SENTRY_URL, this.env.SENTRY_APP_SLUG!, state);
    if (provider === 'vercel') return vercelInstallUrl(this.env.VERCEL_INTEGRATION_SLUG!, state);
    return herokuAuthorizeUrl(this.env.HEROKU_CLIENT_ID!, state);
  }

  async oauthCallback(
    actor: ActorContext,
    provider: OAuthProvider,
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    await this.state.verify(actor, provider, input.state);
    if (!input.code)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'missing_code',
        'The provider did not return an authorization code',
      );
    try {
      if (provider === 'vercel') return await this.vercelCallback(actor, input.code, input);
      if (provider === 'heroku') return await this.herokuCallback(actor, input.code);
      return await this.sentryCallback(actor, input);
    } catch (err) {
      if (err instanceof ApiException) throw err;
      throw setupFailed(err);
    }
  }

  private async vercelCallback(
    actor: ActorContext,
    code: string,
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    const t = await vercelExchange(
      {
        clientId: this.env.VERCEL_CLIENT_ID!,
        clientSecret: this.env.VERCEL_CLIENT_SECRET!,
        redirectUri: callbackUrl(this.env, 'vercel'),
      },
      code,
      this.support.fetchFn,
    );
    const r = await this.toolSetup.vercelWithToken(actor, t.accessToken, input.teamId ?? t.teamId);
    return { provider: 'vercel', done: r.done, todo: r.todo };
  }

  private async herokuCallback(actor: ActorContext, code: string): Promise<OAuthCallbackResult> {
    const t = await herokuExchange(
      { clientSecret: this.env.HEROKU_CLIENT_SECRET! },
      code,
      this.support.fetchFn,
    );
    await this.support.saveRow(actor, {
      provider: 'heroku_oauth',
      name: 'Heroku',
      config: { expiresAt: new Date(Date.now() + t.expiresIn * 1000).toISOString() },
      secrets: { token: t.accessToken, refreshToken: t.refreshToken },
    });
    const apps = await listHerokuApps(t.accessToken, this.support.fetchFn);
    return {
      provider: 'heroku',
      done: ['Signed in to Heroku.'],
      todo: ['Choose the apps that should send logs.'],
      herokuApps: apps,
    };
  }

  private async sentryOrganization(installationId: string, token: string): Promise<string> {
    const res = await this.support.fetchFn(
      `${trimSlash(this.env.SENTRY_URL)}/api/0/sentry-app-installations/${encodeURIComponent(installationId)}/`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
    );
    const inst = (await res.json()) as { organization?: { slug?: string } };
    const org = inst.organization?.slug;
    if (!org) throw new ProvisionError('Sentry did not say which organization was installed');
    return org;
  }

  private async sentryCallback(
    actor: ActorContext,
    input: OAuthCallbackInput,
  ): Promise<OAuthCallbackResult> {
    const installationId = input.installationId;
    if (!installationId)
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'missing_installation',
        'Sentry did not return an installation id',
      );
    const t = await sentryExchange(
      sentryConfig(this.env),
      installationId,
      { grant_type: 'authorization_code', code: input.code! },
      this.support.fetchFn,
    );
    const org = await this.sentryOrganization(installationId, t.token);

    // Alerts arrive on our shared Sentry webhook and are routed by installation to this source.
    await this.tools.alertTarget(actor, 'sentry');
    const sourceId = (await this.tools.get(actor, 'sentry')).alerts.sourceId;
    await this.support.saveRow(actor, {
      provider: 'sentry_app',
      name: `Sentry (${org})`,
      config: { organization: org, alertSourceId: sourceId },
      externalId: installationId,
    });
    await this.tools.connectReader(actor, 'sentry', {
      tool: 'sentry',
      url: this.env.SENTRY_URL,
      organization: org,
      token: t.token,
    });
    // Keep the refresh token next to the access token so the refresher can renew it.
    await this.support.patchReaderSecrets(
      actor.workspaceId,
      'sentry',
      { token: t.token, refreshToken: t.refreshToken, expiresAt: t.expiresAt },
      { auth: 'app', installationId },
    );
    await sentryVerifyInstall(this.env.SENTRY_URL, installationId, t.token, this.support.fetchFn);
    await this.support.record(actor, 'setup.oauth', { target: 'sentry', organization: org });
    return {
      provider: 'sentry',
      done: [
        `Connected Sentry organization "${org}".`,
        'Sentry alerts open incidents here.',
        'The AI can read Sentry issues during investigations.',
      ],
      todo: [
        'In a Sentry alert rule, choose "Send a notification via AI Production Engineer" as an action.',
      ],
    };
  }
}
