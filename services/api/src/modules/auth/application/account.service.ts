import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { InvitationPreview, Me } from '@ape/api-contracts';
import { notFound } from '../../../core/common/errors';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { users, workspaceMembers, workspaces } from '../../../core/db/schema';
import { InvitationService } from './invitation.service';

@Injectable()
export class AccountService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly invitations: InvitationService,
  ) {}

  async me(userId: string, correlationId: string): Promise<Me> {
    await this.invitations.acceptPending(userId, correlationId);
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

  async updateProfile(userId: string, name: string): Promise<void> {
    await this.db.update(users).set({ name }).where(eq(users.id, userId));
  }

  invitationPreview(token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  acceptInvitation(userId: string, token: string, correlationId: string): Promise<string> {
    return this.invitations.accept(userId, token, correlationId);
  }
}
