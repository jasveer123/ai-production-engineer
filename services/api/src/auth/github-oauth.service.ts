import { Inject, Injectable } from '@nestjs/common';
import { ENV, type ApiEnv } from '../config/config.module';
import type { IdentityProfile } from './auth.service';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}
interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/** GitHub OAuth web flow (login only; repo access uses the GitHub App in Phase 3). */
@Injectable()
export class GitHubOAuthService {
  constructor(@Inject(ENV) private readonly env: ApiEnv) {}

  get callbackUrl(): string {
    return `http://localhost:${this.env.API_PORT}/auth/github/callback`;
  }

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GITHUB_OAUTH_CLIENT_ID ?? '',
      redirect_uri: this.callbackUrl,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<IdentityProfile> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: this.env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: this.callbackUrl,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!token.access_token) throw new Error(`GitHub token exchange failed: ${token.error}`);

    const headers = {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/vnd.github+json',
    };
    const [userRes, emailsRes] = await Promise.all([
      fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10_000) }),
      fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!userRes.ok || !emailsRes.ok) throw new Error('GitHub profile request failed');
    const user = (await userRes.json()) as GitHubUser;
    const emails = (await emailsRes.json()) as GitHubEmail[];
    const primary = emails.find((e) => e.primary && e.verified);
    if (!primary) throw new Error('GitHub account has no verified primary email');

    return {
      provider: 'github',
      providerId: String(user.id),
      email: primary.email,
      name: user.name ?? user.login,
      avatarUrl: user.avatar_url,
    };
  }
}
