import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type ApiEnv } from '../config/config.module';
import { AccountLinks } from './account-links.service';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github-oauth.service';
import { InvitationService } from './invitation.service';
import { Mailer } from './mailer.service';
import { SessionService } from './session.service';
import { SessionGuard } from './session.guard';

/** Global so other modules (members) can send account email. */
@Global()
@Module({
  imports: [
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
    Mailer,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
