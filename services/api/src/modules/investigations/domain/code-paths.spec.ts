import { excerpt, mapToRepoPath, parseFrames } from './code-paths';

describe('stack frames to repository code', () => {
  const stack = [
    'at CheckoutService.discountV2 (/app/api/src/services/checkout.ts:81:46)',
    'at async CheckoutService.checkout (/Users/me/demo-shop/api/src/services/checkout.ts:45:9)',
    'at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)',
    'at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
  ];

  it('keeps application frames and drops library/runtime frames', () => {
    expect(parseFrames(stack)).toEqual([
      { fn: 'CheckoutService.discountV2', path: '/app/api/src/services/checkout.ts', line: 81 },
      {
        fn: 'CheckoutService.checkout',
        path: '/Users/me/demo-shop/api/src/services/checkout.ts',
        line: 45,
      },
    ]);
  });

  it('maps runtime paths to repo paths by longest suffix, and never guesses', () => {
    const repo = new Set(['api/src/services/checkout.ts', 'web/src/app/page.tsx']);
    expect(mapToRepoPath('/app/api/src/services/checkout.ts', repo)).toBe(
      'api/src/services/checkout.ts',
    );
    expect(mapToRepoPath('/Users/me/demo-shop/api/src/services/checkout.ts', repo)).toBe(
      'api/src/services/checkout.ts',
    );
    expect(mapToRepoPath('/srv/other/thing.ts', repo)).toBeNull();
  });

  it('numbers lines and marks the failing one', () => {
    const src = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
    const e = excerpt(src, 5, 2);
    expect(e).toMatchObject({ from: 3, to: 7 });
    expect(e.text.split('\n')[2]).toBe('>> 5 | line5');
  });
});
