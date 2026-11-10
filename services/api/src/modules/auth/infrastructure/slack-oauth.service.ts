import { Inject, Injectable } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { IdentityProfile } from '../auth.service';

interface SlackTokenResponse {
  ok: boolean;
  access_token?: string;
  error?: string;
}
interface SlackUserInfo {
  ok: boolean;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  error?: string;
}

@Injectable()
export class SlackOAuthService {
  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  get callbackUrl(): string {
    return `${this.env.OAUTH_CALLBACK_BASE_URL ?? this.env.PUBLIC_API_URL}/auth/slack/callback`;
  }

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.env.SLACK_OAUTH_CLIENT_ID ?? '',
      scope: 'openid profile email',
      redirect_uri: this.callbackUrl,
      state,
    });
    return `https://slack.com/openid/connect/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<IdentityProfile> {
    const tokenRes = await fetch('https://slack.com/api/openid.connect.token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.env.SLACK_OAUTH_CLIENT_ID ?? '',
        client_secret: this.env.SLACK_OAUTH_CLIENT_SECRET ?? '',
        redirect_uri: this.callbackUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const token = (await tokenRes.json()) as SlackTokenResponse;
    if (!token.ok || !token.access_token) {
      throw new Error(`Slack token exchange failed: ${token.error}`);
    }

    const infoRes = await fetch('https://slack.com/api/openid.connect.userInfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const info = (await infoRes.json()) as SlackUserInfo;
    if (!info.ok || !info.sub || !info.email) throw new Error('Slack profile request failed');
    if (!info.email_verified) throw new Error('Slack account email is not verified');

    return {
      provider: 'slack',
      providerId: info.sub,
      email: info.email,
      name: info.name ?? null,
      avatarUrl: info.picture ?? null,
    };
  }
}
