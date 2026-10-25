import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type { Invitation, InvitationWithLink, Member, Role } from '@ape/api-contracts';
import { Mailer } from '../auth/mailer.service';
import { newLinkToken, sha256 } from '../auth/password';
import { ENV, type ApiEnv } from '../config/config.module';
import { AuditService } from '../audit/audit.service';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { users, workspaceInvitations, workspaceMembers } from '../db/schema';
import type { ActorContext } from '../common/request-context';
import { ApiException, conflict, forbidden, notFound } from '../common/errors';
import { canManageRole } from './roles';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class MembersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
  ) {}

  async list(actor: ActorContext): Promise<Member[]> {
    const rows = await this.db
      .select({
        id: workspaceMembers.id,
        userId: users.id,
        email: users.email,
        name: users.name,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, actor.workspaceId))
      .orderBy(asc(workspaceMembers.createdAt));
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async updateRole(actor: ActorContext, memberId: string, role: Role): Promise<Member> {
    return this.db.transaction(async (tx) => {
      const member = await this.lockMember(tx, actor.workspaceId, memberId);
      await this.assertCanManage(actor, member.role, role, 'member.role_changed', memberId);
      if (member.role === 'owner' && role !== 'owner') await this.assertNotLastOwner(tx, actor);

      await tx.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId));
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'member.role_changed',
          resourceType: 'member',
          resourceId: memberId,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { userId: member.userId, from: member.role, to: role },
        },
        tx,
      );
      const [updated] = (await this.list(actor)).filter((m) => m.id === memberId);
      return updated!;
    });
  }

  /** Removing a member takes effect on their next request (membership is checked every time). */
  async remove(actor: ActorContext, memberId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const member = await this.lockMember(tx, actor.workspaceId, memberId);
      await this.assertCanManage(actor, member.role, member.role, 'member.removed', memberId);
      if (member.role === 'owner') await this.assertNotLastOwner(tx, actor);

      await tx.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId));
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'member.removed',
          resourceType: 'member',
          resourceId: memberId,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { userId: member.userId, role: member.role },
        },
        tx,
      );
    });
  }

  async listInvitations(actor: ActorContext): Promise<Invitation[]> {
    const rows = await this.db
      .select({
        id: workspaceInvitations.id,
        email: workspaceInvitations.email,
        role: workspaceInvitations.role,
        createdAt: workspaceInvitations.createdAt,
        expiresAt: workspaceInvitations.expiresAt,
      })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, actor.workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
        ),
      )
      .orderBy(asc(workspaceInvitations.createdAt));
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
    }));
  }

  /**
   * Creates an invitation with a 7-day link. The link is returned once (and emailed); the person
   * registers or signs in through it. A pending invite also applies when that verified email
   * next signs in.
   */
  async invite(actor: ActorContext, email: string, role: Role): Promise<InvitationWithLink> {
    await this.assertCanManage(actor, null, role, 'invitation.created', email);

    const [alreadyMember] = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, actor.workspaceId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      );
    if (alreadyMember) throw conflict('This person is already a member');

    const token = newLinkToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const result = await this.db.transaction(async (tx) => {
      // Replace any earlier pending invite for the same email so there is only one.
      await tx
        .update(workspaceInvitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(workspaceInvitations.workspaceId, actor.workspaceId),
            sql`lower(${workspaceInvitations.email}) = lower(${email})`,
            isNull(workspaceInvitations.acceptedAt),
            isNull(workspaceInvitations.revokedAt),
          ),
        );
      const [inv] = await tx
        .insert(workspaceInvitations)
        .values({
          workspaceId: actor.workspaceId,
          email,
          role,
          invitedBy: actor.userId,
          tokenHash: sha256(token),
          expiresAt,
        })
        .returning();
      await this.audit.record(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'invitation.created',
          resourceType: 'invitation',
          resourceId: inv!.id,
          outcome: 'success',
          correlationId: actor.correlationId,
          metadata: { email, role },
        },
        tx,
      );
      return {
        id: inv!.id,
        email: inv!.email,
        role: inv!.role,
        createdAt: inv!.createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        inviteUrl: `${this.env.WEB_URL}/invite/?token=${token}`,
      };
    });
    await this.mailer.send({
      to: email,
      subject: `You are invited to join as ${role}`,
      text: [
        `You have been invited to an AI Production Engineer workspace as ${role}.`,
        `Accept the invitation: ${result.inviteUrl}`,
        'The link expires in 7 days.',
      ].join('\n\n'),
    });
    return result;
  }

  async revokeInvitation(actor: ActorContext, invitationId: string): Promise<void> {
    const [inv] = await this.db
      .update(workspaceInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(workspaceInvitations.id, invitationId),
          eq(workspaceInvitations.workspaceId, actor.workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
        ),
      )
      .returning({ id: workspaceInvitations.id, email: workspaceInvitations.email });
    if (!inv) throw notFound('Invitation');
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: 'invitation.revoked',
      resourceType: 'invitation',
      resourceId: inv.id,
      outcome: 'success',
      correlationId: actor.correlationId,
      metadata: { email: inv.email },
    });
  }

  private async lockMember(tx: Tx, workspaceId: string, memberId: string) {
    const [member] = await tx
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
      .for('update');
    if (!member) throw notFound('Member');
    return member;
  }

  private async assertCanManage(
    actor: ActorContext,
    current: Role | null,
    target: Role,
    action: string,
    resourceId: string,
  ): Promise<void> {
    if (canManageRole(actor.role, current, target)) return;
    await this.audit.record({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      resourceType: 'member',
      resourceId,
      outcome: 'denied',
      correlationId: actor.correlationId,
      metadata: { reason: 'only_owners_manage_owners', actorRole: actor.role, current, target },
    });
    throw forbidden('Only owners can grant, change or remove the owner role');
  }

  private async assertNotLastOwner(tx: Tx, actor: ActorContext): Promise<void> {
    const [row] = await tx
      .select({ owners: count() })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, actor.workspaceId),
          eq(workspaceMembers.role, 'owner'),
        ),
      );
    if ((row?.owners ?? 0) <= 1) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'last_owner',
        'A workspace must keep at least one owner',
      );
    }
  }
}
