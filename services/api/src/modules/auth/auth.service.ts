import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import { ApiException, unauthorized } from '../../core/common/errors';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { authTokens, users } from '../../core/db/schema';
import { AccountLinks } from './application/account-links.service';
import { badCredentials, badLink } from './auth-errors';
import { InvitationService } from './application/invitation.service';
import { SessionService } from './application/session.service';
import { findUserByEmail } from './infrastructure/user-lookup';
import {
  dummyPasswordHash,
  hashPassword,
  verifyPassword,
  weakPasswordReason,
} from './domain/password';

export interface IdentityProfile {
  provider: 'github' | 'dev';
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export const LOCKOUT_AFTER = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
    private readonly links: AccountLinks,
    private readonly sessions: SessionService,
    private readonly invitations: InvitationService,
  ) {}

  async upsertUser(profile: IdentityProfile): Promise<string> {
    const [byIdentity] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.identityProvider, profile.provider),
          eq(users.identityProviderId, profile.providerId),
        ),
      );
    const existing = byIdentity ?? (await findUserByEmail(this.db, profile.email));

    if (existing) {
      const changes: Partial<typeof users.$inferInsert> = {};
      if (profile.name) changes.name = profile.name;
      if (profile.avatarUrl) changes.avatarUrl = profile.avatarUrl;
      if (profile.provider === 'github') {
        changes.identityProvider = 'github';
        changes.identityProviderId = profile.providerId;
      }
      if (!existing.emailVerifiedAt) {
        changes.emailVerifiedAt = new Date();
        if (existing.passwordHash) {
          changes.passwordHash = null;
          await this.sessions.revokeAll(existing.id);
        }
      }
      if (Object.keys(changes).length > 0) {
        await this.db.update(users).set(changes).where(eq(users.id, existing.id));
      }
      return existing.id;
    }

    const [created] = await this.db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identityProvider: profile.provider,
        identityProviderId: profile.providerId,
        emailVerifiedAt: new Date(),
      })
      .returning({ id: users.id });
    return created!.id;
  }

  async register(input: RegisterInput, correlationId: string): Promise<string> {
    const weak = weakPasswordReason(input.password, input.email);
    if (weak) throw new ApiException(HttpStatus.BAD_REQUEST, 'weak_password', weak);

    const invitation = input.inviteToken
      ? await this.invitations.find(input.inviteToken)
      : undefined;
    if (input.inviteToken && !invitation) throw badLink();
    if (invitation && invitation.email.toLowerCase() !== input.email.toLowerCase()) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invite_email_mismatch',
        `This invitation is for ${invitation.email}. Register with that email.`,
      );
    }

    if (await findUserByEmail(this.db, input.email)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'email_taken',
        'An account with this email already exists. Sign in instead.',
      );
    }

    const passwordHash = await hashPassword(input.password);

    const verified = invitation ? new Date() : null;
    let userId: string;
    try {
      const [created] = await this.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          identityProvider: 'password',
          identityProviderId: input.email.toLowerCase(),
          passwordHash,
          emailVerifiedAt: verified,
        })
        .returning({ id: users.id });
      userId = created!.id;
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === '23505')
        throw new ApiException(
          HttpStatus.CONFLICT,
          'email_taken',
          'An account with this email already exists. Sign in instead.',
        );
      throw err;
    }

    await this.audit.record({
      actorId: userId,
      action: 'auth.registered',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
      metadata: { method: 'password', invited: Boolean(invitation) },
    });
    if (!verified) await this.links.sendVerification(userId, input.email);
    return userId;
  }

  async login(input: LoginInput, correlationId: string, ip: string | undefined): Promise<string> {
    const user = await findUserByEmail(this.db, input.email);
    const deny = async (reason: string, userId?: string) => {
      await this.audit.record({
        actorId: userId ?? null,
        action: 'auth.login',
        resourceType: 'session',
        outcome: 'denied',
        correlationId,
        metadata: { method: 'password', reason, ip },
      });
    };

    if (!user || !user.passwordHash) {
      await verifyPassword(input.password, await dummyPasswordHash());
      await deny(user ? 'no_password' : 'unknown_email', user?.id);
      throw badCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await deny('locked', user.id);
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'account_locked',
        `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      );
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      const [after] = await this.db
        .update(users)
        .set({ failedLoginCount: sql`${users.failedLoginCount} + 1` })
        .where(eq(users.id, user.id))
        .returning({ failed: users.failedLoginCount });
      if ((after?.failed ?? 0) >= LOCKOUT_AFTER) {
        await this.db
          .update(users)
          .set({ lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginCount: 0 })
          .where(eq(users.id, user.id));
        await this.audit.record({
          actorId: user.id,
          action: 'auth.locked',
          resourceType: 'user',
          resourceId: user.id,
          outcome: 'denied',
          correlationId,
          metadata: { ip, minutes: LOCKOUT_MS / 60000 },
        });
      }
      await deny('wrong_password', user.id);
      throw badCredentials();
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.db
        .update(users)
        .set({ failedLoginCount: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    }
    return user.id;
  }

  async forgotPassword(email: string, correlationId: string): Promise<void> {
    const user = await findUserByEmail(this.db, email);
    await this.audit.record({
      actorId: user?.id ?? null,
      action: 'auth.password_reset_requested',
      resourceType: 'user',
      resourceId: user?.id ?? null,
      outcome: user ? 'success' : 'failure',
      correlationId,
      metadata: user ? {} : { reason: 'unknown_email' },
    });
    if (!user) return;
    await this.links.sendPasswordReset(user.id, user.email);
  }

  async resetPassword(token: string, password: string, correlationId: string): Promise<string> {
    const userId = await this.links.consume(token, 'password_reset');
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    const weak = weakPasswordReason(password, user!.email);
    if (weak) throw new ApiException(HttpStatus.BAD_REQUEST, 'weak_password', weak);

    await this.db
      .update(users)
      .set({
        passwordHash: await hashPassword(password),
        failedLoginCount: 0,
        lockedUntil: null,
        emailVerifiedAt: user!.emailVerifiedAt ?? new Date(),
      })
      .where(eq(users.id, userId));
    await this.sessions.revokeAll(userId);

    await this.db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.kind, 'password_reset'),
          isNull(authTokens.usedAt),
        ),
      );
    await this.audit.record({
      actorId: userId,
      action: 'auth.password_reset',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
    });
    return userId;
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordInput,
    correlationId: string,
  ): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw unauthorized();
    if (user.passwordHash) {
      const ok =
        !!input.currentPassword && (await verifyPassword(input.currentPassword, user.passwordHash));
      if (!ok) {
        await this.audit.record({
          actorId: userId,
          action: 'auth.password_changed',
          resourceType: 'user',
          resourceId: userId,
          outcome: 'denied',
          correlationId,
          metadata: { reason: 'wrong_current_password' },
        });
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'wrong_password',
          'Your current password is not right',
        );
      }
    }
    const weak = weakPasswordReason(input.newPassword, user.email);
    if (weak) throw new ApiException(HttpStatus.BAD_REQUEST, 'weak_password', weak);

    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(users.id, userId));
    await this.sessions.revokeOthers(userId, sessionId);
    await this.audit.record({
      actorId: userId,
      action: 'auth.password_changed',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || user.emailVerifiedAt) return;
    await this.links.sendVerification(user.id, user.email);
  }

  async verifyEmail(token: string, correlationId: string): Promise<void> {
    const userId = await this.links.consume(token, 'email_verify');
    await this.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
    await this.audit.record({
      actorId: userId,
      action: 'auth.email_verified',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
    });
    await this.invitations.acceptPending(userId, correlationId);
  }

  async recordLoginFailure(
    correlationId: string,
    method: string,
    outcome: 'denied' | 'failure',
    reason: string,
  ): Promise<void> {
    await this.audit.record({
      action: 'auth.login',
      resourceType: 'session',
      outcome,
      correlationId,
      metadata: { method, reason },
    });
  }
}
