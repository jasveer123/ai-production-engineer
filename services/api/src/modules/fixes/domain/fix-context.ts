import type { SandboxProfile } from '@ape/temporal-workflows';
import { mapToRepoPath, parseFrames } from '../../investigations/domain/code-paths';
import { redact } from '../../investigations/domain/redact';

export const MAX_FILE_CHARS = 30_000;
export const MAX_TESTS = 3;

export interface FixContext {
  version: 1;
  fixProposalId: string;
  repository: string;
  sha: string;
  profile: SandboxProfile;
  incident: { title: string; serviceName: string | null; environment: string | null };
  hypothesis: { summary: string; rationale: string | null; location: unknown };
  stack: string[];

  editable: Record<string, string>;

  tests: Record<string, string>;
  packageJson: string;
  testPath: string;
}

export function inferProfile(file: string, repoPaths: Set<string>): SandboxProfile | null {
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

export function candidateFiles(
  suspectedFile: string | undefined,
  stack: string[],
  repoPaths: Set<string>,
): string[] {
  const candidates = [
    ...(suspectedFile && repoPaths.has(suspectedFile) ? [suspectedFile] : []),
    ...parseFrames(stack)
      .map((f) => mapToRepoPath(f.path, repoPaths))
      .filter((p): p is string => !!p),
  ];
  return [...new Set(candidates)].slice(0, 3);
}

export function exampleTests(paths: string[], testRoot: string, files: string[]): string[] {
  const stems = files.map((f) =>
    f
      .split('/')
      .pop()!
      .replace(/\.[jt]sx?$/, ''),
  );
  const near = (p: string) => Number(stems.some((s) => p.includes(s)));
  return paths
    .filter((p) => p.startsWith(testRoot) && /\.[jt]s$/.test(p))
    .sort((a, b) => near(b) - near(a))
    .filter((p, i) => i < MAX_TESTS || /fixture|helper|setup/.test(p))
    .slice(0, MAX_TESTS + 2);
}

const redactValues = (files: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k, redact(v).text]));

export interface FixContextParts {
  fixProposalId: string;
  repository: string;
  sha: string;
  profile: SandboxProfile;
  incident: { title: string; serviceName: string | null; environment: string | null };
  top?: {
    summary: string;
    confidenceRationale: string | null;
    suspectedLocation: unknown;
  };
  stack: string[];
  sources: { editable: Record<string, string>; tests: Record<string, string>; packageJson: string };
  testPath: string;
}

export function buildFixContext(parts: FixContextParts): FixContext {
  const { incident, top, sources } = parts;
  return {
    version: 1,
    fixProposalId: parts.fixProposalId,
    repository: parts.repository,
    sha: parts.sha,
    profile: parts.profile,
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
    stack: parts.stack.map((l) => redact(l).text),
    editable: redactValues(sources.editable),
    tests: redactValues(sources.tests),
    packageJson: sources.packageJson,
    testPath: parts.testPath,
  };
}
