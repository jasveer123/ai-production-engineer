import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { PullRequestView } from '@ape/api-contracts';
import { notFound } from '../common/errors';
import type { ActorContext } from '../common/request-context';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { approvals, incidents, pullRequests, users } from '../db/schema';
import { PullSyncService } from './pull-sync.service';

@Injectable()
export class PullsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sync: PullSyncService,
  ) {}

  private query() {
    return this.db
      .select({ pr: pullRequests, incidentTitle: incidents.title, approver: users.email })
      .from(pullRequests)
      .leftJoin(incidents, eq(incidents.id, pullRequests.incidentId))
      .leftJoin(approvals, eq(approvals.id, pullRequests.approvalId))
      .leftJoin(users, eq(users.id, approvals.actorId))
      .$dynamic();
  }

  private view(r: {
    pr: typeof pullRequests.$inferSelect;
    incidentTitle: string | null;
    approver: string | null;
  }): PullRequestView {
    const { pr } = r;
    return {
      id: pr.id,
      incidentId: pr.incidentId,
      incidentTitle: r.incidentTitle,
      fixProposalId: pr.fixProposalId,
      repositoryFullName: pr.repositoryFullName,
      number: pr.number,
      url: pr.url,
      title: pr.title,
      branchName: pr.branchName,
      baseBranch: pr.baseBranch,
      status: pr.status as PullRequestView['status'],
      checksStatus: pr.checksStatus as PullRequestView['checksStatus'],
      checks: pr.checks,
      approvedBy: r.approver,
      mergedAt: pr.mergedAt?.toISOString() ?? null,
      lastSyncedAt: pr.lastSyncedAt?.toISOString() ?? null,
      createdAt: pr.createdAt.toISOString(),
    };
  }

  async list(actor: ActorContext): Promise<PullRequestView[]> {
    const rows = await this.query()
      .where(eq(pullRequests.workspaceId, actor.workspaceId))
      .orderBy(desc(pullRequests.createdAt))
      .limit(200);
    return rows.map((r) => this.view(r));
  }

  async forFix(workspaceId: string, fixProposalId: string): Promise<PullRequestView | null> {
    const [row] = await this.query().where(
      and(eq(pullRequests.workspaceId, workspaceId), eq(pullRequests.fixProposalId, fixProposalId)),
    );
    return row ? this.view(row) : null;
  }

  /** "Sync now": re-reads status and checks from GitHub instead of waiting for the poller. */
  async refresh(actor: ActorContext, id: string): Promise<PullRequestView> {
    const [row] = await this.db
      .select()
      .from(pullRequests)
      .where(and(eq(pullRequests.id, id), eq(pullRequests.workspaceId, actor.workspaceId)));
    if (!row) throw notFound('Pull request');
    await this.sync.sync(row);
    const [r] = await this.query().where(eq(pullRequests.id, id));
    return this.view(r!);
  }
}
