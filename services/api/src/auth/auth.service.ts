import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Me } from '@ape/api-contracts';
import { AuditService } from '../audit/audit.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { sessions, users, workspaceInvitations, workspaceMembers, workspaces } from '../db/schema';

export interface IdentityProfile {
  provider: 'github' | 'dev';
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  get sessionTtlMs(): number {
    return this.env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  /**
   * Finds or creates the user for a verified identity. An existing account with the same
   * email is linked, since both GitHub (verified primary email) and dev login vouch for it.
   */
  async upsertUser(profile: IdentityProfile): Promise<string> {
    const [byIdentity] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.identityProvider, profile.provider),
          eq(users.identityProviderId, profile.providerId),
        ),
      );
    const [byEmail] = byIdentity
      ? [byIdentity]
      : await this.db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = lower(${profile.email})`);

    if (byEmail) {
      const changes: Partial<typeof users.$inferInsert> = {};
      if (profile.name) changes.name = profile.name;
      if (profile.avatarUrl) changes.avatarUrl = profile.avatarUrl;
      if (profile.provider === 'github') {
        changes.identityProvider = 'github';
        changes.identityProviderId = profile.providerId;
      }
      if (Object.keys(changes).length > 0) {
        await this.db.update(users).set(changes).where(eq(users.id, byEmail.id));
      }
      return byEmail.id;
    }

    const [created] = await this.db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        identityProvider: profile.provider,
        identityProviderId: profile.providerId,
      })
      .returning({ id: users.id });
    return created!.id;
  }

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

  /** Turns pending invitations for the user's email into memberships. Safe to call repeatedly. */
  async acceptPendingInvitations(userId: string, correlationId: string): Promise<void> {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return;

    const pending = await this.db
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          sql`lower(${workspaceInvitations.email}) = lower(${user.email})`,
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
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
    const [user] = await this.db
      .select({ id: users.id, email: users.email, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId));
    const memberships = await this.db
      .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.status, 'active')))
      .orderBy(workspaces.name);
    return { user: user!, workspaces: memberships, authProviders: this.providers() };
  }

  providers(): Me['authProviders'] {
    return {
      github: Boolean(this.env.GITHUB_OAUTH_CLIENT_ID && this.env.GITHUB_OAUTH_CLIENT_SECRET),
      devLogin: this.env.AUTH_DEV_LOGIN,
    };
  }
}
