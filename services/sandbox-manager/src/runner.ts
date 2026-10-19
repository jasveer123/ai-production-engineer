import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { exec, runInSandbox, type SandboxLimits } from './docker';

export interface SandboxProfile {
  runtime: 'node22-pnpm';
  packageDir: string;
  testCommand: string;
  testDir: string;
}

export interface TestSummary {
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  files: { file: string; tests: number; failures: number }[];
}

export interface SuiteResult {
  /** passed/failed = the tests ran; error = the sandbox could not run them (not a code verdict). */
  status: 'passed' | 'failed' | 'error';
  reason: string | null;
  exitCode: number | null;
  durationMs: number;
  summary: TestSummary;
  stdout: string;
  stderr: string;
}

export const workRoot = () =>
  (process.env.SANDBOX_WORK_DIR ?? '~/.ape/sandbox-work').replace(/^~(?=\/)/, homedir());

/** Paths must stay inside the workspace: no absolute paths, no `..`. */
export function safeRelative(p: string): string {
  const norm = p.replace(/\\/g, '/').replace(/^\.\//, '');
  if (norm.startsWith('/') || norm.split('/').includes('..') || norm.length === 0) {
    throw new Error(`Unsafe path: ${p}`);
  }
  return norm;
}

function walk(dir: string, base = dir, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full));
  }
  return out;
}

/**
 * Builds (once) an image holding only the dependencies of `profile.packageDir`, keyed by the
 * lockfile and manifests. This is the only step with network access; test runs are offline.
 */
export async function ensureDepsImage(sourceDir: string, profile: SandboxProfile): Promise<string> {
  const manifests = walk(sourceDir).filter(
    (f) =>
      f.endsWith('package.json') ||
      f === 'pnpm-lock.yaml' ||
      f === 'pnpm-workspace.yaml' ||
      f === '.npmrc',
  );
  if (!manifests.includes('pnpm-lock.yaml')) throw new Error('Repository has no pnpm-lock.yaml');
  const hash = createHash('sha256');
  hash.update(`${profile.runtime}:${profile.packageDir}`);
  for (const f of manifests.sort()) hash.update(f).update(readFileSync(join(sourceDir, f)));
  const image = `ape-sbx-deps:${hash.digest('hex').slice(0, 16)}`;

  const exists = await exec('docker', ['image', 'inspect', image]);
  if (exists.code === 0) return image;

  const ctx = mkdtempSync(join(workRoot(), 'build-'));
  try {
    for (const f of manifests) {
      mkdirSync(join(ctx, dirname(f)), { recursive: true });
      cpSync(join(sourceDir, f), join(ctx, f));
    }
    const rootPkg = JSON.parse(readFileSync(join(sourceDir, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    const pnpm = /^pnpm@([\d.]+)/.exec(rootPkg.packageManager ?? '')?.[1] ?? '10';
    writeFileSync(
      join(ctx, 'Dockerfile'),
      [
        'FROM node:22-slim',
        `RUN npm install -g pnpm@${pnpm} && pnpm --version`,
        'WORKDIR /deps',
        'COPY . .',
        `RUN pnpm install --frozen-lockfile --filter ./${safeRelative(profile.packageDir)}... && rm -f Dockerfile`,
        'RUN chmod -R a+rX /deps',
      ].join('\n'),
    );
    const build = await exec('docker', ['build', '-q', '-t', image, ctx], {
      timeoutMs: 15 * 60_000,
    });
    if (build.code !== 0)
      throw new Error(`Dependency image build failed: ${build.stderr.slice(-2000)}`);
    return image;
  } finally {
    rmSync(ctx, { recursive: true, force: true });
  }
}

const J_START = '<<<APE_JUNIT>>>';
const J_END = '<<<APE_JUNIT_END>>>';

const attr = (tag: string, name: string) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1]! : '';
};

/** Minimal JUnit reader for vitest's report: one <testsuite> per test file. */
export function parseJUnit(xml: string): TestSummary {
  const summary: TestSummary = { tests: 0, failures: 0, errors: 0, skipped: 0, files: [] };
  for (const m of xml.matchAll(/<testsuite\s[^>]*>/g)) {
    const tag = m[0];
    const tests = Number(attr(tag, 'tests') || 0);
    const failures = Number(attr(tag, 'failures') || 0) + Number(attr(tag, 'errors') || 0);
    summary.tests += tests;
    summary.failures += Number(attr(tag, 'failures') || 0);
    summary.errors += Number(attr(tag, 'errors') || 0);
    summary.skipped += Number(attr(tag, 'skipped') || 0);
    summary.files.push({ file: attr(tag, 'name'), tests, failures });
  }
  return summary;
}

/**
 * Runs the test command in a fresh sandbox: dependencies from the image, source mounted read-only,
 * overlay files (generated test, patched files) on top. `only` limits the run to some test files.
 */
export async function runSuite(opts: {
  image: string;
  sourceDir: string;
  overlay: Record<string, string> | null;
  profile: SandboxProfile;
  only: string[] | null;
  limits?: Partial<SandboxLimits>;
}): Promise<SuiteResult> {
  const job = mkdtempSync(join(workRoot(), 'run-'));
  try {
    const overlayDir = join(job, 'overlay');
    mkdirSync(overlayDir, { recursive: true });
    for (const [path, content] of Object.entries(opts.overlay ?? {})) {
      const target = join(overlayDir, safeRelative(path));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    const pkg = safeRelative(opts.profile.packageDir);
    const only = (opts.only ?? []).map((f) => `'${safeRelative(f).replace(/'/g, '')}'`).join(' ');
    const script = [
      'set -e',
      'cp -R /deps/. /work/',
      // Never take node_modules or .git from the mounted source: dependencies come from the image.
      '(cd /src && tar -cf - --exclude=node_modules --exclude=.git .) | (cd /work && tar -xf -)',
      'cp -R /overlay/. /work/',
      `cd /work/${pkg}`,
      'set +e',
      `${opts.profile.testCommand} ${only} --reporter=default --reporter=junit --outputFile.junit=/tmp/junit.xml`,
      'code=$?',
      `echo '${J_START}'; cat /tmp/junit.xml 2>/dev/null; echo '${J_END}'`,
      'exit $code',
    ].join('\n');
    const r = await runInSandbox(
      opts.image,
      script,
      [
        { host: opts.sourceDir, container: '/src' },
        { host: overlayDir, container: '/overlay' },
      ],
      opts.limits,
    );
    const xml = r.stdout.includes(J_START)
      ? r.stdout.slice(r.stdout.indexOf(J_START) + J_START.length, r.stdout.indexOf(J_END))
      : '';
    const summary = parseJUnit(xml);
    const stdout = r.stdout.replace(/<<<APE_JUNIT>>>[\s\S]*<<<APE_JUNIT_END>>>/, '').slice(-60_000);
    const stderr = r.stderr.slice(-20_000);
    let status: SuiteResult['status'];
    let reason: string | null = null;
    if (r.timedOut) [status, reason] = ['error', 'sandbox_timeout'];
    else if (r.code === 137) [status, reason] = ['error', 'sandbox_killed_out_of_memory'];
    else if (summary.tests === 0) [status, reason] = ['error', 'no_tests_ran'];
    else status = r.code === 0 && summary.failures + summary.errors === 0 ? 'passed' : 'failed';
    return { status, reason, exitCode: r.code, durationMs: r.durationMs, summary, stdout, stderr };
  } finally {
    rmSync(job, { recursive: true, force: true });
  }
}

export function ensureWorkRoot() {
  if (!existsSync(workRoot())) mkdirSync(workRoot(), { recursive: true, mode: 0o700 });
}
