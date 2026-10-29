import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { InvitationPreview } from '@ape/api-contracts';
import { AuditService } from '../../../core/audit/audit.service';
import { ApiException } from '../../../core/common/errors';
import type { Database } from '../../../core/db/client';
import { DB } from '../../../core/db/database.module';
import { users, workspaceInvitations, workspaceMembers, workspaces } from '../../../core/db/schema';
import { badLink } from '../auth-errors';
import { sha256 } from '../domain/password';
import { findUserByEmail } from '../infrastructure/user-lookup';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async find(token: string) {
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

  async preview(token: string): Promise<InvitationPreview> {
    const inv = await this.find(token);
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
      accountExists: Boolean(await findUserByEmail(this.db, inv.email)),
    };
  }

  async accept(userId: string, token: string, correlationId: string): Promise<string> {
    const inv = await this.find(token);
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
    await this.acceptPending(userId, correlationId);
    return inv.workspaceId;
  }

  async acceptPending(userId: string, correlationId: string): Promise<void> {
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
}
