import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type ApiEnv } from '../config/config.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GitHubOAuthService } from './github-oauth.service';
import { SessionGuard } from './session.guard';

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
  providers: [AuthService, GitHubOAuthService, { provide: APP_GUARD, useClass: SessionGuard }],
})
export class AuthModule {}
