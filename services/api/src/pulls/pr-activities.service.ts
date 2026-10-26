import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  IncidentWorkflowInput,
  PrActivities,
  PullRequestOutcome,
} from '@ape/temporal-workflows';
import { AuditService } from '../audit/audit.service';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { ENV, type ApiEnv } from '../config/config.module';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  approvals,
  DEFAULT_APPROVAL_POLICY,
  evidenceItems,
  fixProposals,
  hypotheses,
  incidentEvents,
  incidents,
  pullRequests,
  services,
  users,
  validationRuns,
  workspaceMembers,
  workspaces,
} from '../db/schema';
import { GitHubError } from '../github/github-app';
import { GitHubService } from '../github/github.service';
import { hasRole } from '../workspaces/roles';
import {
  branchName,
  commitMessage,
  prBody,
  prBodyInput,
  prTitle,
  type PrBodyInput,
} from './pr-body';

/** A pull request the re-checks refused to open; reported to the workflow, not retried. */
class PrBlocked extends Error {}

const REQUIRED_PERMISSIONS: Record<string, string> = { contents: 'write', pull_requests: 'write' };

@Injectable()
export class PrActivitiesService implements PrActivities {
  private readonly logger = new Logger(PrActivitiesService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly artifacts: ArtifactStore,
    private readonly github: GitHubService,
    private readonly audit: AuditService,
  ) {}

  private async blocked(
    ws: string,
    fixId: string,
    reason: string,
    correlationId: string,
  ): Promise<PullRequestOutcome> {
    this.logger.warn(`PR for fix ${fixId} blocked: ${reason}`);
    const [fix] = await this.db.select().from(fixProposals).where(eq(fixProposals.id, fixId));
    if (fix?.incidentId) {
      await this.db.insert(incidentEvents).values({
        workspaceId: ws,
        incidentId: fix.incidentId,
        kind: 'fix',
        source: 'github',
        occurredAt: new Date(),
        summary: `Pull request not created: ${reason}`,
        attributes: { fixProposalId: fixId, blocked: true },
      });
    }
    await this.audit.record({
      workspaceId: ws,
      actorType: 'agent',
      action: 'pull_request.create',
      resourceType: 'fix_proposal',
      resourceId: fixId,
      outcome: 'denied',
      correlationId,
      metadata: { reason },
    });
    return { status: 'blocked', reason };
  }

  async createPullRequest(
    input: IncidentWorkflowInput & { fixProposalId: string; approvalId: string },
  ): Promise<PullRequestOutcome> {
    const corr = `pr-${input.fixProposalId}`;
    // Idempotency at our side: one PR row per fix proposal.
    const [already] = await this.db
      .select()
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.fixProposalId, input.fixProposalId),
          eq(pullRequests.workspaceId, input.workspaceId),
        ),
      );
    if (already?.number && already.url)
      return { status: 'existing', number: already.number, url: already.url };
    try {
      return await this.open(input, corr);
    } catch (err) {
      if (!(err instanceof PrBlocked)) throw err;
      return this.blocked(input.workspaceId, input.fixProposalId, err.message, corr);
    }
  }

  private async open(
    input: IncidentWorkflowInput & { fixProposalId: string; approvalId: string },
    corr: string,
  ): Promise<PullRequestOutcome> {
    // ---- Re-checks at execution time (the approval may be minutes or days old). ----
    const approval = await this.requireApproval(input);
    const member = await this.requireApprover(input.workspaceId, approval.actorId);
    const fix = await this.requireValidatedFix(input, approval);
    const { incident, service, repo } = await this.requireTarget(input, fix);
    const installationId = await this.requireInstallation(input.workspaceId, repo);

    // ---- Content: the exact files that passed validation (patched sources + regression test). ----
    const overlayRef = `s3://${this.artifacts.bucket}/fixes/${fix.workspaceId}/${fix.id}/attempt-${fix.patchAttempts}/overlay.json`;
    const overlay = await this.artifacts.getJson<{ files: Record<string, string> }>(overlayRef);
    const bodyInput = await this.bodyInput(incident, fix, member.email);
    const branch = branchName(incident.id, fix.version);
    const base = service.defaultBranch;
    if (branch === base) throw new PrBlocked('Refusing to write to the default branch');

    // ---- Idempotent writes: reuse the branch and PR if a previous attempt created them. ----
    const gh = this.github.gh();
    const at = { installationId, repo };
    const headSha = await this.ensureBranch(at, { branch, fix, overlay, bodyInput });
    const existing = (await gh.listPullsForBranch(installationId, repo, branch))[0];
    const pr =
      existing ??
      (await gh.createPull(installationId, repo, {
        title: prTitle(bodyInput),
        body: prBody(bodyInput),
        head: branch,
        base,
      }));
    await this.recordPullRequest({
      input,
      approval,
      incident,
      fix,
      pr,
      repo,
      branch,
      base,
      headSha,
      existing: Boolean(existing),
      corr,
    });
    return { status: existing ? 'existing' : 'created', number: pr.number, url: pr.html_url };
  }

  private async requireApproval(input: {
    workspaceId: string;
    fixProposalId: string;
    approvalId: string;
  }) {
    const [approval] = await this.db
      .select()
      .from(approvals)
      .where(
        and(
          eq(approvals.id, input.approvalId),
          eq(approvals.workspaceId, input.workspaceId),
          eq(approvals.resourceType, 'pull_request'),
          eq(approvals.resourceId, input.fixProposalId),
          eq(approvals.decision, 'approved'),
        ),
      );
    if (!approval) throw new PrBlocked('No matching approval record');
    return approval;
  }

  /** The approver must still be a member whose role meets the workspace policy. */
  private async requireApprover(workspaceId: string, approverId: string) {
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
    const minRole = ws?.settings.approvalPolicy?.prMinRole ?? DEFAULT_APPROVAL_POLICY.prMinRole;
    const [member] = await this.db
      .select({ role: workspaceMembers.role, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, approverId)),
      );
    if (!member) throw new PrBlocked('The approver is no longer a member of this workspace');
    if (!hasRole(member.role, minRole))
      throw new PrBlocked(
        `The approver's role (${member.role}) no longer meets the policy (${minRole})`,
      );
    return member;
  }

  private async requireValidatedFix(
    input: { workspaceId: string; fixProposalId: string },
    approval: { artifactHash: string | null },
  ) {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(
        and(
          eq(fixProposals.id, input.fixProposalId),
          eq(fixProposals.workspaceId, input.workspaceId),
        ),
      );
    if (!fix || fix.status !== 'validated')
      throw new PrBlocked('The fix is no longer in a validated state');
    if (!fix.patchHash || fix.patchHash !== approval.artifactHash)
      throw new PrBlocked('The patch changed after it was approved');
    return fix;
  }

  private async requireTarget(
    input: { workspaceId: string; incidentId: string },
    fix: typeof fixProposals.$inferSelect,
  ) {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, input.incidentId), eq(incidents.workspaceId, input.workspaceId)));
    const [service] = incident?.serviceId
      ? await this.db
          .select()
          .from(services)
          .where(
            and(eq(services.id, incident.serviceId), eq(services.workspaceId, input.workspaceId)),
          )
      : [];
    const repo = fix.repositoryFullName ?? service?.repositoryFullName;
    if (!incident || !repo || !service)
      throw new PrBlocked('The incident has no mapped repository');
    return { incident, service, repo };
  }

  /** An installation that can write to the repository: present, not suspended, with permissions. */
  private async requireInstallation(workspaceId: string, repo: string): Promise<number> {
    const installationId = await this.github.installationFor(workspaceId, repo);
    if (!installationId) throw new PrBlocked(`No connected GitHub installation can access ${repo}`);
    try {
      const inst = await this.github.gh().getInstallation(installationId);
      if (inst.suspended_at) throw new PrBlocked('The GitHub App installation is suspended');
      const missing = Object.entries(REQUIRED_PERMISSIONS).filter(
        ([k, v]) => inst.permissions[k] !== v,
      );
      if (missing.length)
        throw new PrBlocked(
          `The GitHub App lacks ${missing.map(([k, v]) => `${k}:${v}`).join(', ')}`,
        );
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404)
        throw new PrBlocked('The GitHub App was uninstalled');
      throw err;
    }
    return installationId;
  }

  /** Commits the validated files on a new branch, or reuses the branch an earlier attempt made. */
  private async ensureBranch(
    at: { installationId: number; repo: string },
    change: {
      branch: string;
      fix: typeof fixProposals.$inferSelect;
      overlay: { files: Record<string, string> };
      bodyInput: PrBodyInput;
    },
  ): Promise<string | null> {
    const { installationId, repo } = at;
    const { branch, fix, overlay } = change;
    const gh = this.github.gh();
    const existing = await gh.getBranchSha(installationId, repo, branch);
    if (existing) return existing;
    const baseCommit = await gh.getCommit(installationId, repo, fix.baseCommitSha);
    const blobs = await Promise.all(
      Object.entries(overlay.files).map(async ([path, content]) => ({
        path,
        sha: (await gh.createBlob(installationId, repo, content)).sha,
      })),
    );
    const tree = await gh.createTree(installationId, repo, baseCommit.tree.sha, blobs);
    const commit = await gh.createCommit(
      installationId,
      repo,
      commitMessage(change.bodyInput),
      tree.sha,
      fix.baseCommitSha,
    );
    try {
      await gh.createBranch(installationId, repo, branch, commit.sha);
      return commit.sha;
    } catch (err) {
      // A concurrent or earlier attempt created it first: use that branch.
      if (!(err instanceof GitHubError && err.status === 422)) throw err;
      return gh.getBranchSha(installationId, repo, branch);
    }
  }

  private async recordPullRequest(r: {
    input: IncidentWorkflowInput;
    approval: typeof approvals.$inferSelect;
    incident: typeof incidents.$inferSelect;
    fix: typeof fixProposals.$inferSelect;
    pr: Awaited<ReturnType<ReturnType<GitHubService['gh']>['createPull']>>;
    repo: string;
    branch: string;
    base: string;
    headSha: string | null;
    existing: boolean;
    corr: string;
  }): Promise<void> {
    const { input, approval, incident, fix, pr, repo, branch, base } = r;
    await this.db
      .insert(pullRequests)
      .values({
        workspaceId: input.workspaceId,
        incidentId: incident.id,
        fixProposalId: fix.id,
        approvalId: approval.id,
        repositoryFullName: repo,
        branchName: branch,
        baseBranch: base,
        headSha: pr.head.sha ?? r.headSha,
        providerPrId: String(pr.id),
        number: pr.number,
        url: pr.html_url,
        title: pr.title,
        status: pr.merged_at ? 'merged' : pr.state,
      })
      .onConflictDoUpdate({
        target: pullRequests.fixProposalId,
        set: {
          number: pr.number,
          url: pr.html_url,
          providerPrId: String(pr.id),
          headSha: pr.head.sha,
        },
      });
    await this.db.insert(incidentEvents).values({
      workspaceId: input.workspaceId,
      incidentId: incident.id,
      kind: 'fix',
      source: 'github',
      occurredAt: new Date(),
      summary: `Pull request #${pr.number} ${r.existing ? 'found' : 'opened'} on ${repo} (${branch} → ${base})`,
      sourceUrl: pr.html_url,
      attributes: { fixProposalId: fix.id, number: pr.number },
    });
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorType: 'agent',
      actorId: approval.actorId,
      action: 'pull_request.created',
      resourceType: 'pull_request',
      resourceId: String(pr.number),
      outcome: 'success',
      correlationId: r.corr,
      metadata: {
        repo,
        branch,
        base,
        url: pr.html_url,
        existing: r.existing,
        approvalId: approval.id,
      },
    });
  }

  private async bodyInput(
    incident: typeof incidents.$inferSelect,
    fix: typeof fixProposals.$inferSelect,
    approver: string,
  ): Promise<PrBodyInput> {
    const [top] = await this.db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.investigationId, fix.investigationId))
      .orderBy(asc(hypotheses.rank))
      .limit(1);
    const ev = top
      ? await this.db
          .select()
          .from(evidenceItems)
          .where(eq(evidenceItems.investigationId, fix.investigationId))
      : [];
    const runs = await this.db
      .select()
      .from(validationRuns)
      .where(eq(validationRuns.fixProposalId, fix.id))
      .orderBy(desc(validationRuns.createdAt));
    return prBodyInput({
      incident,
      fix,
      top,
      evidence: ev,
      runs,
      approver,
      webUrl: this.env.WEB_URL,
    });
  }
}
