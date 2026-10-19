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
import { branchName, commitMessage, prBody, prTitle, type PrBodyInput } from './pr-body';

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
    const block = (reason: string) =>
      this.blocked(input.workspaceId, input.fixProposalId, reason, corr);

    // Idempotency at our side: one PR row per fix proposal.
    const [already] = await this.db
      .select()
      .from(pullRequests)
      .where(eq(pullRequests.fixProposalId, input.fixProposalId));
    if (already?.number && already.url)
      return { status: 'existing', number: already.number, url: already.url };

    // ---- Re-checks at execution time (the approval may be minutes or days old). ----
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
    if (!approval) return block('No matching approval record');

    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceId));
    const minRole = ws?.settings.approvalPolicy?.prMinRole ?? DEFAULT_APPROVAL_POLICY.prMinRole;
    const [member] = await this.db
      .select({ role: workspaceMembers.role, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, approval.actorId),
        ),
      );
    if (!member) return block('The approver is no longer a member of this workspace');
    if (!hasRole(member.role, minRole))
      return block(`The approver's role (${member.role}) no longer meets the policy (${minRole})`);

    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, input.fixProposalId));
    if (!fix || fix.status !== 'validated')
      return block('The fix is no longer in a validated state');
    if (!fix.patchHash || fix.patchHash !== approval.artifactHash)
      return block('The patch changed after it was approved');

    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(eq(incidents.id, input.incidentId));
    const [service] = incident?.serviceId
      ? await this.db.select().from(services).where(eq(services.id, incident.serviceId))
      : [];
    const repo = fix.repositoryFullName ?? service?.repositoryFullName;
    if (!incident || !repo || !service) return block('The incident has no mapped repository');
    const installationId = await this.github.installationFor(input.workspaceId, repo);
    if (!installationId) return block(`No connected GitHub installation can access ${repo}`);
    const gh = this.github.gh();
    try {
      const inst = await gh.getInstallation(installationId);
      if (inst.suspended_at) return block('The GitHub App installation is suspended');
      const missing = Object.entries(REQUIRED_PERMISSIONS).filter(
        ([k, v]) => inst.permissions[k] !== v,
      );
      if (missing.length)
        return block(`The GitHub App lacks ${missing.map(([k, v]) => `${k}:${v}`).join(', ')}`);
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404)
        return block('The GitHub App was uninstalled');
      throw err;
    }

    // ---- Content: the exact files that passed validation (patched sources + regression test). ----
    const overlayRef = `s3://${this.artifacts.bucket}/fixes/${fix.workspaceId}/${fix.id}/attempt-${fix.patchAttempts}/overlay.json`;
    const overlay = await this.artifacts.getJson<{ files: Record<string, string> }>(overlayRef);
    const bodyInput = await this.bodyInput(incident, fix, member.email);
    const branch = branchName(incident.id, fix.version);
    const base = service.defaultBranch;
    if (branch === base) return block('Refusing to write to the default branch');

    // ---- Idempotent writes: reuse the branch and PR if a previous attempt created them. ----
    let headSha = await gh.getBranchSha(installationId, repo, branch);
    if (!headSha) {
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
        commitMessage(bodyInput),
        tree.sha,
        fix.baseCommitSha,
      );
      try {
        await gh.createBranch(installationId, repo, branch, commit.sha);
        headSha = commit.sha;
      } catch (err) {
        // A concurrent or earlier attempt created it first: use that branch.
        if (!(err instanceof GitHubError && err.status === 422)) throw err;
        headSha = await gh.getBranchSha(installationId, repo, branch);
      }
    }
    const existing = (await gh.listPullsForBranch(installationId, repo, branch))[0];
    const pr =
      existing ??
      (await gh.createPull(installationId, repo, {
        title: prTitle(bodyInput),
        body: prBody(bodyInput),
        head: branch,
        base,
      }));

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
        headSha: pr.head.sha ?? headSha,
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
      summary: `Pull request #${pr.number} ${existing ? 'found' : 'opened'} on ${repo} (${branch} → ${base})`,
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
      correlationId: corr,
      metadata: {
        repo,
        branch,
        base,
        url: pr.html_url,
        existing: Boolean(existing),
        approvalId: approval.id,
      },
    });
    return { status: existing ? 'existing' : 'created', number: pr.number, url: pr.html_url };
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
    const cited = new Set(top?.supportingEvidenceIds ?? []);
    const runs = await this.db
      .select()
      .from(validationRuns)
      .where(eq(validationRuns.fixProposalId, fix.id))
      .orderBy(desc(validationRuns.createdAt));
    return {
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        serviceName: incident.serviceName,
        environment: incident.environment,
        eventCount: incident.eventCount,
      },
      dashboardUrl: `${this.env.WEB_URL}/w/${incident.workspaceId}/incidents/${incident.id}`,
      hypothesis: top
        ? {
            summary: top.summary,
            rationale: top.confidenceRationale,
            location: top.suspectedLocation as NonNullable<PrBodyInput['hypothesis']>['location'],
          }
        : null,
      evidence: ev
        .filter((e) => cited.has(e.id))
        .sort((a, b) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)))
        .map((e) => ({ ref: e.ref, title: e.title, sourceUrl: e.sourceUrl })),
      fix: {
        version: fix.version,
        explanation: fix.explanation,
        diffStat: fix.diffStat ?? null,
        baseCommitSha: fix.baseCommitSha,
        testPath: fix.testPath,
      },
      runs: runs
        .reverse()
        .map((r) => ({ kind: r.kind, attempt: r.attempt, status: r.status, summary: r.summary })),
      approver,
    };
  }
}
