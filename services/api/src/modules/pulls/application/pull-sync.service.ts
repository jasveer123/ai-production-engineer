import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../../../core/audit/audit.service';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { incidentEvents, pullRequests } from '../../../core/db/schema';
import { GitHubError } from '../../../connectors/github/infrastructure/github-app';
import { GitHubService } from '../../../connectors/github/github.service';
import { TemporalService } from '../../../core/temporal/temporal.service';

type PrRow = typeof pullRequests.$inferSelect;
type ChecksStatus = PrRow['checksStatus'];

export function summarizeChecks(
  runs: { status: string; conclusion: string | null }[],
): ChecksStatus {
  if (runs.length === 0) return 'none';
  const bad = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
  if (runs.some((r) => r.conclusion && bad.includes(r.conclusion))) return 'failing';
  if (runs.some((r) => r.status !== 'completed')) return 'pending';
  return 'passing';
}

const pullStatus = (pr: {
  merged_at: string | null;
  state: string;
}): 'open' | 'merged' | 'closed' =>
  pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';

@Injectable()
export class PullSyncService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PullSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly github: GitHubService,
    private readonly temporal: TemporalService,
    private readonly audit: AuditService,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.INGEST_WORKER_ENABLED || !this.github.configured) return;
    this.timer = setInterval(() => void this.syncAll(), this.env.PR_SYNC_INTERVAL_MS);
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  async syncAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const open = await this.db.select().from(pullRequests).where(eq(pullRequests.status, 'open'));
      for (const pr of open) {
        await this.sync(pr).catch((e: unknown) =>
          this.logger.warn(
            `Sync of PR ${pr.repositoryFullName}#${pr.number} failed: ${(e as Error).message}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }

  async syncByNumber(repo: string, number: number): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(pullRequests)
      .where(and(eq(pullRequests.repositoryFullName, repo), eq(pullRequests.number, number)));
    for (const row of rows) await this.sync(row);
    return rows.length > 0;
  }

  async sync(row: PrRow): Promise<PrRow> {
    if (!row.number || !row.repositoryFullName) return row;
    const remote = await this.fetchRemote(row, row.number, row.repositoryFullName);
    if (!remote) return row;
    const { pr, checks } = remote;
    const status = pullStatus(pr);
    const checksStatus = summarizeChecks(checks);
    const [updated] = await this.db
      .update(pullRequests)
      .set({
        status,
        headSha: pr.head.sha,
        checksStatus,
        checks: checks.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
        mergeCommitSha: pr.merge_commit_sha && pr.merged_at ? pr.merge_commit_sha : null,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        lastSyncedAt: new Date(),
      })

      .where(and(eq(pullRequests.id, row.id), eq(pullRequests.status, row.status)))
      .returning();
    if (!updated) {
      const [current] = await this.db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.id, row.id));
      return current ?? row;
    }

    if (row.checksStatus !== checksStatus && checksStatus !== 'pending' && row.incidentId) {
      await this.event(row, `CI checks on PR #${row.number}: ${checksStatus}`, { checksStatus });
    }
    if (row.status === 'open' && status !== 'open')
      await this.reportTransition(row, updated, status);
    return updated;
  }

  private async fetchRemote(row: PrRow, number: number, repo: string) {
    const installationId = await this.github.installationFor(row.workspaceId, repo);
    if (!installationId) return null;
    const gh = this.github.gh();
    try {
      const pr = await gh.getPull(installationId, repo, number);
      return { pr, checks: await gh.checkRuns(installationId, repo, pr.head.sha) };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }

  private async reportTransition(
    row: PrRow,
    updated: PrRow,
    status: 'merged' | 'closed',
  ): Promise<void> {
    if (row.incidentId) {
      await this.event(row, `Pull request #${row.number} was ${status}`, {
        status,
        mergeCommitSha: updated.mergeCommitSha ?? null,
      });
      await this.temporal
        .pullRequestStatus(row.incidentId, {
          status,
          number: row.number!,
          mergeCommitSha: updated.mergeCommitSha ?? null,
        })
        .catch((e: unknown) =>
          this.logger.warn(`Could not signal the workflow: ${(e as Error).message}`),
        );
    }
    await this.audit.record({
      workspaceId: row.workspaceId,
      actorType: 'system',
      action: `pull_request.${status}`,
      resourceType: 'pull_request',
      resourceId: row.id,
      outcome: 'success',
      correlationId: `pr-sync-${row.id}`,
      metadata: { repo: row.repositoryFullName, number: row.number },
    });
  }

  private async event(row: PrRow, summary: string, attributes: Record<string, unknown>) {
    await this.db.insert(incidentEvents).values({
      workspaceId: row.workspaceId,
      incidentId: row.incidentId!,
      kind: 'fix',
      source: 'github',
      occurredAt: new Date(),
      summary,
      sourceUrl: row.url,
      attributes: { ...attributes, number: row.number },
    });
  }
}
