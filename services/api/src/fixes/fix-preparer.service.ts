import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type {
  IncidentWorkflowInput,
  PrepareFixResult,
  SandboxProfile,
} from '@ape/temporal-workflows';
import { ArtifactStore } from '../artifacts/artifact-store.service';
import type { Database } from '../db/client';
import { DB } from '../db/database.module';
import {
  deployments,
  fixProposals,
  hypotheses,
  incidentEvents,
  incidents,
  investigations,
  services,
} from '../db/schema';
import { GitHubService } from '../github/github.service';
import {
  candidateFiles,
  exampleTests,
  inferProfile,
  MAX_FILE_CHARS,
  buildFixContext,
} from './fix-context';

/** A step of prepareFix that cannot continue: reported to the workflow, not thrown to Temporal. */
export class PrepareFailed extends Error {
  constructor(
    reason: string,
    readonly fixProposalId: string | null = null,
  ) {
    super(reason);
  }
}

interface RepoRef {
  gh: ReturnType<GitHubService['gh']>;
  installationId: number;
  repo: string;
  sha: string;
}

/** Pins the failing commit, picks the files to fix and stores the context the worker reads. */
@Injectable()
export class FixPreparer {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly artifacts: ArtifactStore,
    private readonly github: GitHubService,
  ) {}

  async prepare(
    input: IncidentWorkflowInput & { runKey: string; version: number },
  ): Promise<PrepareFixResult> {
    const { incident, inv, service, repo } = await this.loadTarget(input);

    // Idempotent per (workflow run, version): an activity retry reuses the row.
    const existing = await this.existingFix(input);
    const installationId = await this.github.installationFor(input.workspaceId, repo);
    if (!installationId)
      throw new PrepareFailed(
        `No connected GitHub installation can read ${repo}`,
        existing?.id ?? null,
      );
    const gh = this.github.gh();
    const sha =
      existing?.baseCommitSha ??
      (await this.pinCommit(input.workspaceId, incident, {
        gh,
        installationId,
        repo,
        branch: service.defaultBranch,
      }));
    const fix = existing ?? (await this.createFix(input, { investigationId: inv.id, repo, sha }));

    const { top, stack } = await this.failureEvidence(incident.id, inv.id);
    const { paths } = await gh.tree(installationId, repo, sha);
    const repoPaths = new Set(paths);
    const suspected = (top?.suspectedLocation as { file?: string } | null)?.file;
    const files = candidateFiles(suspected, stack, repoPaths);
    if (files.length === 0)
      throw new PrepareFailed('Could not map the failure to a file in the repository', fix.id);
    const profile = service.sandbox ?? inferProfile(files[0]!, repoPaths);
    if (!profile)
      throw new PrepareFailed('Unsupported project: expected a pnpm workspace with vitest', fix.id);

    const ref = { gh, installationId, repo, sha };
    const sources = await this.readSources(ref, { files, paths, profile });
    if (Object.keys(sources.editable).length === 0)
      throw new PrepareFailed('No editable source file within the package', fix.id);

    const sourceRef = await this.artifacts.putBytes(
      `sources/${input.workspaceId}/${repo}/${sha}.tar.gz`,
      await gh.tarball(installationId, repo, sha),
      'application/gzip',
    );
    const testPath = `${sources.testRoot}ape-regression-${incident.id.slice(0, 8)}.test.ts`;
    const context = buildFixContext({
      fixProposalId: fix.id,
      repository: repo,
      sha,
      profile,
      incident,
      top,
      stack,
      sources,
      testPath,
    });
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

  private async createFix(
    input: IncidentWorkflowInput & { runKey: string; version: number },
    at: { investigationId: string; repo: string; sha: string },
  ) {
    const [fix] = await this.db
      .insert(fixProposals)
      .values({
        workspaceId: input.workspaceId,
        incidentId: input.incidentId,
        investigationId: at.investigationId,
        workflowRunKey: input.runKey,
        version: input.version,
        repositoryFullName: at.repo,
        baseCommitSha: at.sha,
        status: 'preparing',
      })
      .returning();
    return fix!;
  }

  /** The incident, its latest completed investigation and the repository its service maps to. */
  private async loadTarget(input: IncidentWorkflowInput) {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, input.incidentId), eq(incidents.workspaceId, input.workspaceId)));
    const [inv] = await this.db
      .select()
      .from(investigations)
      .where(
        and(
          eq(investigations.incidentId, input.incidentId),
          eq(investigations.workspaceId, input.workspaceId),
          eq(investigations.status, 'completed'),
        ),
      )
      .orderBy(desc(investigations.createdAt))
      .limit(1);
    if (!incident || !inv) throw new PrepareFailed('No completed investigation to reproduce');
    const [service] = incident.serviceId
      ? await this.db
          .select()
          .from(services)
          .where(
            and(eq(services.id, incident.serviceId), eq(services.workspaceId, input.workspaceId)),
          )
      : [];
    const repo = service?.repositoryFullName;
    if (!service || !repo) throw new PrepareFailed('The service is not mapped to a repository');
    return { incident, inv, service, repo };
  }

  private async existingFix(input: { runKey: string; version: number; workspaceId: string }) {
    const [existing] = await this.db
      .select()
      .from(fixProposals)
      .where(
        and(
          eq(fixProposals.workspaceId, input.workspaceId),
          eq(fixProposals.workflowRunKey, input.runKey),
          eq(fixProposals.version, input.version),
        ),
      );
    return existing;
  }

  /** Pins the exact code that failed: the deployed commit when known, else the branch head now. */
  private async pinCommit(
    workspaceId: string,
    incident: { serviceName: string | null },
    repo: Pick<RepoRef, 'gh' | 'installationId' | 'repo'> & { branch: string },
  ): Promise<string> {
    const [deploy] = await this.db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.workspaceId, workspaceId),
          eq(deployments.serviceName, incident.serviceName ?? ''),
        ),
      )
      .orderBy(desc(deployments.deployedAt))
      .limit(1);
    if (deploy && /^[0-9a-f]{40}$/i.test(deploy.commitSha)) return deploy.commitSha;
    const [head] = await repo.gh.listCommits(repo.installationId, repo.repo, {
      sha: repo.branch,
      limit: 1,
    });
    return head!.sha;
  }

  /** The top hypothesis and the newest error's stack: what the fix has to address. */
  private async failureEvidence(incidentId: string, investigationId: string) {
    const [top] = await this.db
      .select()
      .from(hypotheses)
      .where(eq(hypotheses.investigationId, investigationId))
      .orderBy(hypotheses.rank)
      .limit(1);
    const [errorEvent] = await this.db
      .select()
      .from(incidentEvents)
      .where(and(eq(incidentEvents.incidentId, incidentId), eq(incidentEvents.kind, 'error')))
      .orderBy(desc(incidentEvents.occurredAt))
      .limit(1);
    const stack = ((errorEvent?.attributes as { stack?: string[] } | undefined)?.stack ?? []).slice(
      0,
      8,
    );
    return { top, stack };
  }

  /** Reads the editable files, example tests and package.json at the pinned commit. */
  private async readSources(
    ref: RepoRef,
    plan: { files: string[]; paths: string[]; profile: SandboxProfile },
  ) {
    const { gh, installationId, repo, sha } = ref;
    const { files, paths, profile } = plan;
    const editable: Record<string, string> = {};
    for (const f of files.filter((p) => p.startsWith(`${profile.packageDir}/`))) {
      const content = await gh.fileContent(installationId, repo, f, sha);
      if (content.length <= MAX_FILE_CHARS) editable[f] = content;
    }
    const testRoot = `${profile.packageDir}/${profile.testDir}/`;
    const tests: Record<string, string> = {};
    for (const t of exampleTests(paths, testRoot, files))
      tests[t] = (await gh.fileContent(installationId, repo, t, sha)).slice(0, MAX_FILE_CHARS);
    const packageJson = await gh.fileContent(
      installationId,
      repo,
      `${profile.packageDir}/package.json`,
      sha,
    );
    return { editable, tests, packageJson, testRoot };
  }
}
