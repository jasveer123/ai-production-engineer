import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type {
  ApplyPatchResult,
  FixActivities,
  IncidentWorkflowInput,
  PrepareFixResult,
  RunKind,
  SandboxProfile,
} from '@ape/temporal-workflows';
import { AuditService } from '../audit/audit.service';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import { DB } from '../db/database.module';
import type { Database } from '../db/client';
import {
  deployments,
  fixProposals,
  hypotheses,
  incidentEvents,
  incidents,
  investigations,
  services,
  usageRecords,
  validationRuns,
  type IncidentStatus,
} from '../db/schema';
import { GitHubService } from '../github/github.service';
import { canTransition } from '../incidents/lifecycle';
import { mapToRepoPath, parseFrames } from '../investigations/code-paths';
import { redact } from '../investigations/redact';
import { applyEdits, type Edit } from './patch';

const MAX_FILE_CHARS = 30_000;
const MAX_TESTS = 3;

/** Context the Python worker uses to write the test and the patch (stored in S3). */
export interface FixContext {
  version: 1;
  fixProposalId: string;
  repository: string;
  sha: string;
  profile: SandboxProfile;
  incident: { title: string; serviceName: string | null; environment: string | null };
  hypothesis: { summary: string; rationale: string | null; location: unknown };
  stack: string[];
  /** Source files the fix may edit (repo-relative path -> content). */
  editable: Record<string, string>;
  /** Existing tests and helpers, as examples of style and fixtures (read-only). */
  tests: Record<string, string>;
  packageJson: string;
  testPath: string;
}

@Injectable()
export class FixActivitiesService implements FixActivities {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly artifacts: ArtifactStore,
    private readonly github: GitHubService,
    private readonly audit: AuditService,
  ) {}

  async prepareFix(
    input: IncidentWorkflowInput & { runKey: string; version: number },
  ): Promise<PrepareFixResult> {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(eq(incidents.id, input.incidentId));
    const [inv] = await this.db
      .select()
      .from(investigations)
      .where(
        and(
          eq(investigations.incidentId, input.incidentId),
          eq(investigations.status, 'completed'),
        ),
      )
      .orderBy(desc(investigations.createdAt))
      .limit(1);
    const fail = async (
      reason: string,
      fixProposalId: string | null = null,
    ): Promise<PrepareFixResult> => {
      if (fixProposalId) await this.updateFix({ fixProposalId, status: 'error', reason });
      return { ok: false, fixProposalId, reason };
    };
    if (!incident || !inv) return fail('No completed investigation to reproduce');
    const [service] = incident.serviceId
      ? await this.db.select().from(services).where(eq(services.id, incident.serviceId))
      : [];
    const repo = service?.repositoryFullName;
    if (!repo) return fail('The service is not mapped to a repository');

    // Idempotent per (workflow run, version): an activity retry reuses the row.
    const [existing] = await this.db
      .select()
      .from(fixProposals)
      .where(
        and(eq(fixProposals.workflowRunKey, input.runKey), eq(fixProposals.version, input.version)),
      );
    const installationId = await this.github.installationFor(input.workspaceId, repo);
    if (!installationId)
      return fail(`No connected GitHub installation can read ${repo}`, existing?.id ?? null);
    const gh = this.github.gh();

    // Pin the exact code that failed: the deployed commit when known, else the branch head now.
    const [deploy] = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, input.workspaceId),
          eq(deployments.serviceName, incident.serviceName ?? ''),
        ),
      )
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    const sha =
      existing?.baseCommitSha ??
      (deploy && /^[0-9a-f]{40}$/i.test(deploy.commitSha)
        ? deploy.commitSha
        : (await gh.listCommits(installationId, repo, { sha: service.defaultBranch, limit: 1 }))[0]!
            .sha);

    const fix =
      existing ??
      (
        await this.db
          .insert(fixProposals)
          .values({
            workspaceId: input.workspaceId,
            incidentId: input.incidentId,
            investigationId: inv.id,
            workflowRunKey: input.runKey,
            version: input.version,
            repositoryFullName: repo,
            baseCommitSha: sha,
            status: 'preparing',
          })
          .returning()
      )[0]!;

    const [top] = await this.db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.investigationId, inv.id))
      .orderBy(hypotheses.rank)
      .limit(1);
    const [errorEvent] = await this.db
      .select()
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incident.id), eq(incidentEvents.kind, 'error')))
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(1);
    const stack = ((errorEvent?.attributes as { stack?: string[] } | undefined)?.stack ?? []).slice(
      0,
      8,
    );

    const { paths } = await gh.tree(installationId, repo, sha);
    const repoPaths = new Set(paths);
    const suspected = (top?.suspectedLocation as { file?: string } | null)?.file;
    const candidates = [
      ...(suspected && repoPaths.has(suspected) ? [suspected] : []),
      ...parseFrames(stack)
        .map((f) => mapToRepoPath(f.path, repoPaths))
        .filter((p): p is string => !!p),
    ];
    const files = [...new Set(candidates)].slice(0, 3);
    if (files.length === 0)
      return fail('Could not map the failure to a file in the repository', fix.id);

    const profile = service.sandbox ?? this.inferProfile(files[0]!, repoPaths);
    if (!profile) return fail('Unsupported project: expected a pnpm workspace with vitest', fix.id);

    const editable: Record<string, string> = {};
    for (const f of files.filter((p) => p.startsWith(`${profile.packageDir}/`))) {
      const content = await gh.fileContent(installationId, repo, f, sha);
      if (content.length <= MAX_FILE_CHARS) editable[f] = content;
    }
    const testRoot = `${profile.packageDir}/${profile.testDir}/`;
    const stems = files.map((f) =>
      f
        .split('/')
        .pop()!
        .replace(/\.[jt]sx?$/, ''),
    );
    const testFiles = paths
      .filter((p) => p.startsWith(testRoot) && /\.[jt]s$/.test(p))
      .sort(
        (a, b) =>
          Number(stems.some((s) => b.includes(s))) - Number(stems.some((s) => a.includes(s))),
      )
      .filter((p, i) => i < MAX_TESTS || /fixture|helper|setup/.test(p))
      .slice(0, MAX_TESTS + 2);
    const tests: Record<string, string> = {};
    for (const t of testFiles)
      tests[t] = (await gh.fileContent(installationId, repo, t, sha)).slice(0, MAX_FILE_CHARS);
    const packageJson = await gh.fileContent(
      installationId,
      repo,
      `${profile.packageDir}/package.json`,
      sha,
    );

    const sourceRef = await this.artifacts.putBytes(
      `sources/${input.workspaceId}/${repo}/${sha}.tar.gz`,
      await gh.tarball(installationId, repo, sha),
      'application/gzip',
    );
    const testPath = `${testRoot}ape-regression-${incident.id.slice(0, 8)}.test.ts`;
    const context: FixContext = {
      version: 1,
      fixProposalId: fix.id,
      repository: repo,
      sha,
      profile,
      incident: {
        title: incident.title,
        serviceName: incident.serviceName,
        environment: incident.environment,
      },
      hypothesis: {
        summary: top?.summary ?? incident.title,
        rationale: top?.confidenceRationale ?? null,
        location: top?.suspectedLocation ?? null,
      },
      stack: stack.map((l) => redact(l).text),
      editable: Object.fromEntries(Object.entries(editable).map(([k, v]) => [k, redact(v).text])),
      tests: Object.fromEntries(Object.entries(tests).map(([k, v]) => [k, redact(v).text])),
      packageJson,
      testPath,
    };
    if (Object.keys(context.editable).length === 0)
      return fail('No editable source file within the package', fix.id);
    const contextRef = await this.artifacts.putJson(
      `fixes/${input.workspaceId}/${fix.id}/context.json`,
      context,
    );
    await this.db
      .update(fixProposals)
      .set({ sourceReference: sourceRef, testPath, status: 'reproducing' })
      .where(eq(fixProposals.id, fix.id));
    return { ok: true, fixProposalId: fix.id, sourceRef, contextRef, profile, testPath };
  }

  /** Convention for this MVP: nearest package with vitest in a pnpm workspace. */
  private inferProfile(file: string, repoPaths: Set<string>): SandboxProfile | null {
    if (!repoPaths.has('pnpm-lock.yaml')) return null;
    const parts = file.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const dir = parts.slice(0, i).join('/');
      if (repoPaths.has(`${dir}/package.json`)) {
        const testDir = [...repoPaths].some((p) => p.startsWith(`${dir}/test/`)) ? 'test' : 'src';
        return {
          runtime: 'node22-pnpm',
          packageDir: dir,
          testCommand: 'pnpm exec vitest run',
          testDir,
        };
      }
    }
    return null;
  }

  async testOverlay({ fixProposalId, testRef }: { fixProposalId: string; testRef: string }) {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, fixProposalId));
    const test = await this.artifacts.getJson<{ path: string; content: string }>(testRef);
    const overlayRef = await this.artifacts.putJson(
      `fixes/${fix!.workspaceId}/${fixProposalId}/overlay-test.json`,
      {
        files: { [test.path]: test.content },
      },
    );
    return { overlayRef };
  }

  async applyPatch(input: {
    fixProposalId: string;
    attempt: number;
    patchRef: string;
    testRef: string;
  }): Promise<ApplyPatchResult> {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, input.fixProposalId));
    const ctxRef = `s3://${this.artifacts.bucket}/fixes/${fix!.workspaceId}/${fix!.id}/context.json`;
    const ctx = await this.artifacts.getJson<FixContext>(ctxRef);
    const patch = await this.artifacts.getJson<{ edits: Edit[]; explanation: string }>(
      input.patchRef,
    );
    const test = await this.artifacts.getJson<{ path: string; content: string }>(input.testRef);
    const outcome = applyEdits(ctx.editable, patch.edits);

    const base = `fixes/${fix!.workspaceId}/${fix!.id}/attempt-${input.attempt}`;
    if (!outcome.ok) {
      await this.recordRun({
        fixProposalId: fix!.id,
        kind: 'policy',
        attempt: input.attempt,
        image: 'policy-check',
        result: {
          status: 'failed',
          reason: 'policy_violation',
          summary: { violations: outcome.violations },
        },
      });
      return {
        ok: false,
        overlayRef: null,
        violations: outcome.violations,
        diffStat: outcome.diffStat,
      };
    }
    const diffRef = await this.artifacts.putText(`${base}/patch.diff`, outcome.diff, 'text/x-diff');
    const overlayRef = await this.artifacts.putJson(`${base}/overlay.json`, {
      files: { ...outcome.files, [test.path]: test.content },
    });
    await this.db
      .update(fixProposals)
      .set({
        patchReference: diffRef,
        patchHash: createHash('sha256').update(outcome.diff).digest('hex'),
        diffStat: outcome.diffStat,
        explanation: patch.explanation,
        patchAttempts: input.attempt,
        policyViolations: [],
      })
      .where(eq(fixProposals.id, fix!.id));
    await this.recordRun({
      fixProposalId: fix!.id,
      kind: 'policy',
      attempt: input.attempt,
      image: 'policy-check',
      result: { status: 'passed', reason: null, summary: { diffStat: outcome.diffStat } },
    });
    return { ok: true, overlayRef, violations: [], diffStat: outcome.diffStat };
  }

  async recordRun(input: {
    fixProposalId: string;
    kind: RunKind;
    attempt: number;
    image: string;
    result: {
      status: 'passed' | 'failed' | 'error' | 'skipped';
      reason: string | null;
      exitCode?: number | null;
      durationMs?: number;
      summary: Record<string, unknown>;
      outputRef?: string | null;
    };
  }): Promise<void> {
    const [fix] = await this.db
      .select()
      .from(fixProposals)
      .where(eq(fixProposals.id, input.fixProposalId));
    await this.db.insert(validationRuns).values({
      workspaceId: fix!.workspaceId,
      fixProposalId: input.fixProposalId,
      kind: input.kind,
      attempt: input.attempt,
      sandboxImage: input.image,
      status: input.result.status,
      exitCode: input.result.exitCode ?? null,
      durationMs: input.result.durationMs ?? null,
      summary: { ...input.result.summary, reason: input.result.reason },
      resultReference: input.result.outputRef ?? null,
    });
    if (input.result.durationMs) {
      await this.db.insert(usageRecords).values({
        workspaceId: fix!.workspaceId,
        metric: 'sandbox_seconds',
        quantity: String(input.result.durationMs / 1000),
      });
    }
  }

  async updateFix(input: Parameters<FixActivities['updateFix']>[0]): Promise<void> {
    const patch: Partial<typeof fixProposals.$inferInsert> = { status: input.status };
    if (input.reason !== undefined) patch.statusReason = input.reason;
    if (input.testRef) patch.testReference = input.testRef;
    if (input.testRationale) patch.testRationale = input.testRationale;
    if (input.explanation) patch.explanation = input.explanation;
    if (input.patchAttempts !== undefined) patch.patchAttempts = input.patchAttempts;
    const [fix] = await this.db
      .update(fixProposals)
      .set(patch)
      .where(eq(fixProposals.id, input.fixProposalId))
      .returning();
    if (
      fix &&
      [
        'validated',
        'validation_failed',
        'not_reproduced',
        'baseline_failed',
        'error',
        'rejected',
      ].includes(input.status)
    ) {
      await this.db.insert(incidentEvents).values({
        workspaceId: fix.workspaceId,
        incidentId: fix.incidentId!,
        kind: 'fix',
        source: 'sandbox',
        occurredAt: new Date(),
        summary: `Fix v${fix.version}: ${input.status.replace(/_/g, ' ')}${input.reason ? ` (${input.reason})` : ''}`,
        attributes: { fixProposalId: fix.id, status: input.status },
      });
      await this.audit.record({
        workspaceId: fix.workspaceId,
        actorType: 'agent',
        action: `fix.${input.status}`,
        resourceType: 'fix_proposal',
        resourceId: fix.id,
        outcome: input.status === 'error' ? 'failure' : 'success',
        correlationId: fix.workflowRunKey ?? fix.id,
        metadata: { reason: input.reason ?? null, attempts: fix.patchAttempts },
      });
    }
  }

  async setIncidentStatus(
    input: IncidentWorkflowInput & { to: string; summary: string },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [inc] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, input.incidentId))
        .for('update');
      const to = input.to as IncidentStatus;
      if (!inc || inc.status === to || !canTransition(inc.status, to)) return;
      await tx
        .update(incidents)
        .set({ status: to, version: inc.version + 1 })
        .where(eq(incidents.id, inc.id));
      await tx.insert(incidentEvents).values({
        workspaceId: inc.workspaceId,
        incidentId: inc.id,
        kind: 'status_change',
        source: 'workflow',
        occurredAt: new Date(),
        summary: `Status changed from ${inc.status} to ${to}. ${input.summary}`,
        attributes: { from: inc.status, to, reason: input.summary },
      });
    });
  }
}
