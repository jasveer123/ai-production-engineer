import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type {
  ChangePasswordInput,
  InvitationPreview,
  LoginInput,
  Me,
  RegisterInput,
} from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException, notFound, unauthorized } from '../common/errors';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  authTokens,
  sessions,
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from '../db/schema';
import { Mailer } from './mailer.service';
import {
  dummyPasswordHash,
  hashPassword,
  newLinkToken,
  sha256,
  verifyPassword,
  weakPasswordReason,
} from './password';

export interface IdentityProfile {
  provider: 'github' | 'dev';
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

type UserRow = typeof users.$inferSelect;

export const LOCKOUT_AFTER = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFY_TTL_MS = 48 * 60 * 60 * 1000;

const badCredentials = () =>
  new ApiException(HttpStatus.UNAUTHORIZED, 'invalid_credentials', 'Wrong email or password');
const badLink = () =>
  new ApiException(
    HttpStatus.BAD_REQUEST,
    'invalid_link',
    'This link is invalid or has expired. Ask for a new one.',
  );

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
  ) {}

  get sessionTtlMs(): number {
    return this.env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  private async byEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
    return row;
  }

  /**
   * Finds or creates the user for a verified identity (GitHub or dev login). An existing account
   * with the same email is linked. If that account was registered with a password but never
   * verified its email, the password is removed and its sessions revoked: otherwise someone could
   * pre-register the victim's email and keep access after the victim signs in with GitHub.
   */
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
    const existing = byIdentity ?? (await this.byEmail(profile.email));

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
          await this.revokeAllSessions(existing.id);
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

  // ---------- Password accounts ----------

  async register(input: RegisterInput, correlationId: string): Promise<string> {
    const weak = weakPasswordReason(input.password, input.email);
    if (weak) throw new ApiException(HttpStatus.BAD_REQUEST, 'weak_password', weak);

    const invitation = input.inviteToken ? await this.findInvitation(input.inviteToken) : undefined;
    if (input.inviteToken && !invitation) throw badLink();
    if (invitation && invitation.email.toLowerCase() !== input.email.toLowerCase()) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'invite_email_mismatch',
        `This invitation is for ${invitation.email}. Register with that email.`,
      );
    }

    if (await this.byEmail(input.email)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'email_taken',
        'An account with this email already exists. Sign in instead.',
      );
    }

    const passwordHash = await hashPassword(input.password);
    // The invite link was given to this address, so it proves the email.
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
      // Lost a race with a concurrent registration for the same email.
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
    if (!verified) await this.sendVerification(userId, input.email);
    return userId;
  }

  /** Checks email + password with lockout. Returns the user id; every failure looks the same. */
  async login(input: LoginInput, correlationId: string, ip: string | undefined): Promise<string> {
    const user = await this.byEmail(input.email);
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

  /** Always succeeds from the caller's point of view, so it cannot be used to find accounts. */
  async forgotPassword(email: string, correlationId: string): Promise<void> {
    const user = await this.byEmail(email);
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
    const token = await this.issueToken(user.id, 'password_reset', RESET_TTL_MS);
    await this.mailer.send({
      to: user.email,
      subject: 'Reset your password',
      text: [
        'Someone asked to reset the password for your AI Production Engineer account.',
        `Set a new password: ${this.env.WEB_URL}/reset-password/?token=${token}`,
        'The link works once and expires in 30 minutes. If this was not you, ignore this email.',
      ].join('\n\n'),
    });
  }

  /** Sets the new password, verifies the email (the link proved it) and signs out everywhere. */
  async resetPassword(token: string, password: string, correlationId: string): Promise<string> {
    const userId = await this.consumeToken(token, 'password_reset');
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
    await this.revokeAllSessions(userId);
    // Other outstanding reset links stop working too.
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

  /** Changes (or, for GitHub-only accounts, sets) the password and ends every other session. */
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
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessions.userId, userId), ne(sessions.id, sessionId), isNull(sessions.revokedAt)),
      );
    await this.audit.record({
      actorId: userId,
      action: 'auth.password_changed',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
    });
  }

  async updateProfile(userId: string, name: string): Promise<void> {
    await this.db.update(users).set({ name }).where(eq(users.id, userId));
  }

  async sendVerification(userId: string, email: string): Promise<void> {
    const token = await this.issueToken(userId, 'email_verify', VERIFY_TTL_MS);
    await this.mailer.send({
      to: email,
      subject: 'Confirm your email',
      text: [
        'Confirm the email for your AI Production Engineer account:',
        `${this.env.WEB_URL}/verify-email/?token=${token}`,
        'The link expires in 48 hours.',
      ].join('\n\n'),
    });
  }

  async resendVerification(userId: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user.id, user.email);
  }

  async verifyEmail(token: string, correlationId: string): Promise<void> {
    const userId = await this.consumeToken(token, 'email_verify');
    await this.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
    await this.audit.record({
      actorId: userId,
      action: 'auth.email_verified',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'success',
      correlationId,
    });
    await this.acceptPendingInvitations(userId, correlationId);
  }

  private async issueToken(userId: string, kind: string, ttlMs: number): Promise<string> {
    const token = newLinkToken();
    await this.db.insert(authTokens).values({
      userId,
      kind,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  /** Marks a link token used, atomically, and returns its user. */
  private async consumeToken(token: string, kind: string): Promise<string> {
    const [row] = await this.db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokens.tokenHash, sha256(token)),
          eq(authTokens.kind, kind),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: authTokens.userId });
    if (!row) throw badLink();
    return row.userId;
  }

  // ---------- Invitations ----------

  private async findInvitation(token: string) {
    const [inv] = await this.db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.tokenHash, sha256(token)),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, new Date()),
        ),
      );
    return inv;
  }

  async invitationPreview(token: string): Promise<InvitationPreview> {
    const inv = await this.findInvitation(token);
    if (!inv) throw badLink();
    const [ws] = await this.db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, inv.workspaceId));
    const [inviter] = inv.invitedBy
      ? await this.db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, inv.invitedBy))
      : [];
    return {
      email: inv.email,
      role: inv.role,
      workspaceName: ws?.name ?? 'a workspace',
      invitedBy: inviter ? (inviter.name ?? inviter.email) : null,
      accountExists: Boolean(await this.byEmail(inv.email)),
    };
  }

  /** Accepts an invite link for a signed-in user whose email matches it. */
  async acceptInvitation(userId: string, token: string, correlationId: string): Promise<string> {
    const inv = await this.findInvitation(token);
    if (!inv) throw badLink();
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'invite_email_mismatch',
        `This invitation is for ${inv.email}. Sign in with that email.`,
      );
    }
    if (!user.emailVerifiedAt) {
      await this.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
    }
    await this.acceptPendingInvitations(userId, correlationId);
    return inv.workspaceId;
  }

  // ---------- Sessions ----------

  /** Creates a DB-backed session and returns the signed cookie value. */
  async createSession(userId: string, correlationId: string, method: string): Promise<string> {
    const [session] = await this.db
      .insert(sessions)
      .values({ userId, expiresAt: new Date(Date.now() + this.sessionTtlMs) })
      .returning({ id: sessions.id });
    await this.acceptPendingInvitations(userId, correlationId);
    await this.audit.record({
      actorId: userId,
      action: 'auth.login',
      resourceType: 'session',
      resourceId: session!.id,
      outcome: 'success',
      correlationId,
      metadata: { method },
    });
    return this.jwt.signAsync(
      { sub: userId, sid: session!.id },
      { expiresIn: Math.floor(this.sessionTtlMs / 1000) },
    );
  }

  async revokeSession(userId: string, sessionId: string, correlationId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
    await this.audit.record({
      actorId: userId,
      action: 'auth.logout',
      resourceType: 'session',
      resourceId: sessionId,
      outcome: 'success',
      correlationId,
    });
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  /**
   * Turns pending invitations for the user's email into memberships. Only for verified emails:
   * anyone can register an unverified account with someone else's address. Safe to repeat.
   */
  async acceptPendingInvitations(userId: string, correlationId: string): Promise<void> {
    const [user] = await this.db
      .select({ email: users.email, verified: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.verified) return;

    const pending = await this.db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          sql`lower(${workspaceInvitations.email}) = lower(${user.email})`,
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          sql`(${workspaceInvitations.expiresAt} is null or ${workspaceInvitations.expiresAt} > now())`,
        ),
      );

    for (const inv of pending) {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(workspaceMembers)
          .values({ workspaceId: inv.workspaceId, userId, role: inv.role })
          .onConflictDoNothing();
        await tx
          .update(workspaceInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(workspaceInvitations.id, inv.id));
        await this.audit.record(
          {
            workspaceId: inv.workspaceId,
            actorId: userId,
            action: 'invitation.accepted',
            resourceType: 'invitation',
            resourceId: inv.id,
            outcome: 'success',
            correlationId,
            metadata: { role: inv.role },
          },
          tx,
        );
      });
    }
  }

  async me(userId: string, correlationId: string): Promise<Me> {
    await this.acceptPendingInvitations(userId, correlationId);
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw notFound('User');
    const memberships = await this.db
      .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.status, 'active')))
      .orderBy(workspaces.name);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: Boolean(user.emailVerifiedAt),
        hasPassword: Boolean(user.passwordHash),
      },
      workspaces: memberships,
      authProviders: this.providers(),
    };
  }

  providers(): Me['authProviders'] {
    return {
      password: true,
      github: Boolean(this.env.GITHUB_OAUTH_CLIENT_ID && this.env.GITHUB_OAUTH_CLIENT_SECRET),
      devLogin: this.env.AUTH_DEV_LOGIN,
    };
  }
}
