import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import { incidentEvents, pullRequests } from '../db/schema';
import { GitHubError } from '../github/github-app';
import { GitHubService } from '../github/github.service';
import { TemporalService } from '../temporal/temporal.service';

type PrRow = typeof pullRequests.$inferSelect;
type ChecksStatus = PrRow['checksStatus'];

/** Rolls GitHub check runs up into one status: any failure fails, anything unfinished is pending. */
export function summarizeChecks(
  runs: { status: string; conclusion: string | null }[],
): ChecksStatus {
  if (runs.length === 0) return 'none';
  const bad = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
  if (runs.some((r) => r.conclusion && bad.includes(r.conclusion))) return 'failing';
  if (runs.some((r) => r.status !== 'completed')) return 'pending';
  return 'passing';
}

/**
 * Keeps pull request status and CI checks in sync with GitHub, and tells the incident workflow
 * when a PR is merged or closed. GitHub is always re-read, so a webhook payload is only a hint.
 */
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
    // Only the API process polls (the Temporal worker process disables ingestion).
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

  /** Called by the webhook: syncs the tracked PR with this repository and number, if any. */
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
    if (!remote) return row; // access revoked or PR gone: keep the last known state
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
      // Optimistic: if a concurrent sync (webhook + poller) already moved the row, it reports.
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

  /** The pull request and its check runs from GitHub; null when it can no longer be read. */
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

  /** Only the sync that sees the transition reports it, so the workflow is signalled once. */
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
