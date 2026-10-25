import { HttpStatus } from '@nestjs/common';
import type { GitHubOverview, SetupPrInput } from '@ape/api-contracts';
import { ApiException } from '../common/errors';
import { GitHubError, type GitHubAppClient } from '../github/github-app';
import { missingPermissions, NEEDED_PERMISSIONS } from '../github/github.service';
import {
  DEPLOY_WORKFLOW_PATH,
  deployWorkflow,
  detectProject,
  nodeChanges,
  pythonChanges,
  setupPrBody,
  type FileChanges,
} from './setup-pr';

export type SetupPrRequest = SetupPrInput & { environment: string };
type Installation = GitHubOverview['installations'][number];

export interface RepoTarget {
  gh: GitHubAppClient;
  installationId: number;
  repo: string;
}

/** The installation that can see the requested repository, with the permissions it needs. */
export function requireInstallation(overview: GitHubOverview, input: SetupPrRequest): Installation {
  const inst = overview.installations.find((i) =>
    i.repositories.some((r) => r.toLowerCase() === input.repository.toLowerCase()),
  );
  if (!inst)
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'repo_not_connected',
      overview.installations.length
        ? `The GitHub App cannot see ${input.repository}. Add it to the installation on GitHub (${overview.installations[0]!.manageUrl}), then try again.`
        : 'Connect GitHub first.',
    );
  const lacking = missingPermissions(
    inst.permissions,
    input.kind === 'deploy'
      ? NEEDED_PERMISSIONS.deployWorkflow
      : NEEDED_PERMISSIONS.setupPullRequest,
  );
  if (lacking.length)
    throw new ApiException(
      HttpStatus.FORBIDDEN,
      'github_permission',
      `The GitHub App is missing ${lacking.join(', ')}. Add it in the App's permissions${overview.appPermissionsUrl ? ` (${overview.appPermissionsUrl})` : ''}, then accept the new permissions on the installation (${inst.manageUrl}).`,
    );
  return inst;
}

export function deployChanges(
  input: SetupPrRequest,
  urls: { apiUrl: string; audience: string },
  branch: string,
): FileChanges {
  const workflow = deployWorkflow({
    service: input.service,
    environment: input.environment,
    apiUrl: urls.apiUrl,
    audience: urls.audience,
    branch,
  });
  return {
    files: { [DEPLOY_WORKFLOW_PATH]: workflow },
    done: [
      `Added \`${DEPLOY_WORKFLOW_PATH}\`: after each push to \`${branch}\` it tells us which commit of \`${input.service}\` is live.`,
      'It signs in with the GitHub Actions OIDC token, so no secret was added to the repository.',
    ],
    todo: [
      'If you deploy from another workflow, move its "Send deploy marker" step to the end of that workflow.',
    ],
    language: null,
    needsLockfileUpdate: false,
  };
}

/** Agent-install changes for the app found in the repository. */
export async function projectChanges(
  t: RepoTarget,
  input: SetupPrRequest,
  baseSha: string,
  endpoint: string,
): Promise<FileChanges> {
  const { paths } = await t.gh.tree(t.installationId, t.repo, baseSha);
  const read = (p: string) => t.gh.fileContent(t.installationId, t.repo, p, baseSha);
  const project = detectProject(paths, input.directory || undefined);
  if (!project)
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'unknown_project',
      'No package.json, pyproject.toml or requirements.txt found. Set the app folder, or use OpenTelemetry or the HTTP API.',
    );
  const build = project.language === 'node' ? nodeChanges : pythonChanges;
  const changes = await build(
    { paths, read },
    project.dir,
    input.service,
    input.environment,
    endpoint,
  );
  changes.todo.push(
    "Set `APE_TOKEN` (your workspace ingest token) in the app's environment, then deploy.",
  );
  return changes;
}

export function setupBranchName(input: SetupPrRequest): string {
  return `ape/setup-${input.kind}-${input.service.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export function setupPrTitle(input: SetupPrRequest): string {
  return input.kind === 'deploy'
    ? `Send deploy markers for ${input.service}`
    : `Connect ${input.service} to AI Production Engineer`;
}

/** Creates the setup branch unless an earlier run already did. Returns true when it existed. */
export async function ensureBranch(
  t: RepoTarget,
  opts: { branch: string; title: string; baseSha: string; files: FileChanges['files'] },
): Promise<boolean> {
  const { gh, installationId, repo } = t;
  if (await gh.getBranchSha(installationId, repo, opts.branch)) return true;
  const base = await gh.getCommit(installationId, repo, opts.baseSha);
  const blobs = await Promise.all(
    Object.entries(opts.files).map(async ([path, content]) => ({
      path,
      sha: (await gh.createBlob(installationId, repo, content)).sha,
    })),
  );
  const tree = await gh.createTree(installationId, repo, base.tree.sha, blobs);
  const commit = await gh.createCommit(installationId, repo, opts.title, tree.sha, opts.baseSha);
  await gh.createBranch(installationId, repo, opts.branch, commit.sha);
  return false;
}

/** Reuses the open pull request for the branch, or opens one (a draft if a lockfile is stale). */
export async function openOrReusePull(
  t: RepoTarget,
  opts: {
    branch: string;
    title: string;
    base: string;
    kind: SetupPrInput['kind'];
    changes: FileChanges;
  },
) {
  const { gh, installationId, repo } = t;
  const prior = (await gh.listPullsForBranch(installationId, repo, opts.branch)).find(
    (p) => p.state === 'open',
  );
  const draft = opts.changes.needsLockfileUpdate;
  const pr =
    prior ??
    (await gh.createPull(installationId, repo, {
      title: opts.title,
      body: setupPrBody(opts.kind, opts.changes),
      head: opts.branch,
      base: opts.base,
      draft,
    }));
  return { pr, draft, reused: Boolean(prior) };
}

/** Turns a GitHub 403 into the permission message users can act on. */
export function mapGitHubError(err: unknown): unknown {
  if (err instanceof ApiException) return err;
  if (err instanceof GitHubError && err.status === 403)
    return new ApiException(
      HttpStatus.FORBIDDEN,
      'github_permission',
      'The GitHub App needs "Contents: write", "Pull requests: write" and "Workflows: write" on this repository.',
    );
  return err;
}
