import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type ApiEnv } from '../../core/config/config.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AccountLinks } from './application/account-links.service';
import { AccountService } from './application/account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './infrastructure/github-oauth.service';
import { InvitationService } from './application/invitation.service';
import { Mailer } from './infrastructure/mailer.service';
import { OAuthProviders } from './infrastructure/oauth-providers.service';
import { SlackOAuthService } from './infrastructure/slack-oauth.service';
import { SessionService } from './application/session.service';
import { SessionGuard } from './session.guard';

@Global()
@Module({
  imports: [
    WorkspacesModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ENV],
      useFactory: (env: ApiEnv) => ({
        secret: env.JWT_SECRET,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  exports: [Mailer],
  providers: [
    AuthService,
    AccountLinks,
    AccountService,
    InvitationService,
    SessionService,
    GitHubOAuthService,
    SlackOAuthService,
    OAuthProviders,
    Mailer,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
