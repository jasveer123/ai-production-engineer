import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Workspace } from '@ape/api-contracts';
import { AuditService } from '../../core/audit/audit.service';
import { DB } from '../../core/db/database.module';
import type { Database } from '../../core/db/client';
import { workspaceMembers, workspaces } from '../../core/db/schema';
import type { ActorContext } from '../../core/common/request-context';
import { notFound } from '../../core/common/errors';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, name: string, correlationId: string): Promise<Workspace> {
    return this.db.transaction(async (tx) => {
      const [ws] = await tx.insert(workspaces).values({ name }).returning();
      await tx.insert(workspaceMembers).values({ workspaceId: ws!.id, userId, role: 'owner' });
      await this.audit.record(
        {
          workspaceId: ws!.id,
          actorId: userId,
          action: 'workspace.created',
          resourceType: 'workspace',
          resourceId: ws!.id,
          outcome: 'success',
          correlationId,
          metadata: { name },
        },
        tx,
      );
      return { id: ws!.id, name: ws!.name, plan: ws!.plan, status: ws!.status, role: 'owner' };
    });
  }

  async get(actor: ActorContext): Promise<Workspace> {
    const [ws] = await this.db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, actor.workspaceId)));
    if (!ws) throw notFound('Workspace');
    return { id: ws.id, name: ws.name, plan: ws.plan, status: ws.status, role: actor.role };
  }
}
