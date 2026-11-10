import { Injectable } from '@nestjs/common';
import type { IdentityProfile } from '../auth.service';
import { GitHubOAuthService } from './github-oauth.service';
import { SlackOAuthService } from './slack-oauth.service';

export type OAuthProvider = 'github' | 'slack';

export interface OAuthFlow {
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<IdentityProfile>;
}

@Injectable()
export class OAuthProviders {
  constructor(
    private readonly github: GitHubOAuthService,
    private readonly slack: SlackOAuthService,
  ) {}

  flow(provider: OAuthProvider): OAuthFlow {
    return provider === 'github' ? this.github : this.slack;
  }
}
