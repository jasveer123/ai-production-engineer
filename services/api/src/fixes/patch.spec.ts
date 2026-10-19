import { applyEdits } from './patch';

const SRC = {
  'api/src/services/checkout.ts': [
    "const promo = this.promotions.get(code ?? '') as Coupon;",
    'return Math.floor((subtotalCents * promo.percentOff) / 100);',
  ].join('\n'),
};

describe('applyEdits', () => {
  it('applies an exact edit and produces a unified diff', () => {
    const r = applyEdits(SRC, [
      {
        path: 'api/src/services/checkout.ts',
        find: "const promo = this.promotions.get(code ?? '') as Coupon;",
        replace:
          "if (!code) return 0;\nconst promo = this.promotions.get(code);\nif (!promo) throw new AppError(400, 'invalid_coupon', 'bad');",
      },
    ]);
    expect(r.ok).toBe(true);
    expect(r.diff).toContain('+if (!code) return 0;');
    expect(r.diffStat).toEqual({ files: 1, additions: 3, deletions: 1 });
  });

  it('rejects edits to files outside the editable set, tests, manifests and CI', () => {
    const r = applyEdits(SRC, [
      { path: 'api/src/other.ts', find: 'x', replace: 'y' },
      { path: 'api/package.json', find: 'x', replace: 'y' },
      { path: 'api/test/checkout.test.ts', find: 'x', replace: 'y' },
      { path: '.github/workflows/ci.yml', find: 'x', replace: 'y' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(4);
  });

  it('requires the find text to match exactly once', () => {
    const r = applyEdits({ 'a.ts': 'x\nx\n' }, [{ path: 'a.ts', find: 'x', replace: 'y' }]);
    expect(r.violations[0]).toContain('matched 2 times');
  });

  it('blocks network calls, process spawning and eval in added lines', () => {
    const r = applyEdits(SRC, [
      {
        path: 'api/src/services/checkout.ts',
        find: 'return Math.floor',
        replace:
          "await fetch('https://evil.test'); require('child_process'); eval('1');\nreturn Math.floor",
      },
    ]);
    expect(r.violations.join('\n')).toMatch(
      /network call[\s\S]*starts processes[\s\S]*evaluates code/,
    );
  });

  it('rejects oversized patches', () => {
    const big = Array.from({ length: 100 }, (_, i) => `// line ${i}`).join('\n');
    const r = applyEdits(SRC, [
      {
        path: 'api/src/services/checkout.ts',
        find: 'return Math.floor',
        replace: `${big}\nreturn Math.floor`,
      },
    ]);
    expect(r.violations.join()).toContain('a fix should be minimal');
  });
});
