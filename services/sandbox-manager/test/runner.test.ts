/**
 * End-to-end runner test against the real demo-shop checkout (when present next to this repo):
 * builds the deps image, runs the suite offline, and runs one overlay test file.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensureDepsImage,
  ensureWorkRoot,
  parseJUnit,
  runSuite,
  safeRelative,
  type SandboxProfile,
} from '../src/runner';

const SHOP = join(__dirname, '../../../../demo-shop');
const profile: SandboxProfile = {
  runtime: 'node22-pnpm',
  packageDir: 'api',
  testCommand: 'pnpm exec vitest run',
  testDir: 'test',
};

describe('runner helpers', () => {
  it('rejects paths that escape the workspace', () => {
    expect(() => safeRelative('../etc/passwd')).toThrow();
    expect(() => safeRelative('/etc/passwd')).toThrow();
    expect(safeRelative('./api/test/x.test.ts')).toBe('api/test/x.test.ts');
  });

  it('reads vitest JUnit output', () => {
    const s = parseJUnit(
      '<testsuites><testsuite name="test/a.test.ts" tests="3" failures="1" errors="0" skipped="0"></testsuite>' +
        '<testsuite name="test/b.test.ts" tests="2" failures="0" errors="0" skipped="1"></testsuite></testsuites>',
    );
    expect(s).toMatchObject({ tests: 5, failures: 1, skipped: 1 });
    expect(s.files[0]).toEqual({ file: 'test/a.test.ts', tests: 3, failures: 1 });
  });
});

(existsSync(SHOP) ? describe : describe.skip)('runner on demo-shop (real Docker)', () => {
  let image: string;
  beforeAll(async () => {
    ensureWorkRoot();
    image = await ensureDepsImage(SHOP, profile);
  }, 15 * 60_000);

  it('runs the existing suite offline and it passes', async () => {
    const r = await runSuite({ image, sourceDir: SHOP, overlay: null, profile, only: null });
    expect(r.status).toBe('passed');
    expect(r.summary.tests).toBeGreaterThan(10);
  });

  it('runs only an overlay test file and reports its failure', async () => {
    const r = await runSuite({
      image,
      sourceDir: SHOP,
      overlay: {
        'api/test/generated.test.ts':
          "import { it, expect } from 'vitest';\nit('fails on purpose', () => expect(1).toBe(2));\n",
      },
      profile,
      only: ['test/generated.test.ts'],
    });
    expect(r.status).toBe('failed');
    expect(r.summary).toMatchObject({ tests: 1, failures: 1 });
  });
});
