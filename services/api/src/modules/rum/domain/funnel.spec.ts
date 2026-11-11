import { reachedPerStep } from './funnel';

const ev = (
  sessionId: string,
  ts: number,
  type: string,
  name: string,
  url: string | null = null,
) => ({
  sessionId,
  ts,
  type,
  name,
  url,
});

describe('funnel', () => {
  const steps = [
    { kind: 'pageview' as const, match: '/pricing' },
    { kind: 'event' as const, match: 'add_to_cart' },
    { kind: 'pageview' as const, match: '/checkout/*' },
  ];

  it('counts sessions that reach each step in order', () => {
    const events = [
      ev('a', 1, 'pageview', '', 'https://x.test/pricing?ref=1'),
      ev('a', 2, 'custom', 'add_to_cart'),
      ev('a', 3, 'pageview', '', 'https://x.test/checkout/pay'),
      ev('b', 1, 'pageview', '', 'https://x.test/pricing'),
      ev('b', 2, 'custom', 'add_to_cart'),
      ev('c', 1, 'custom', 'add_to_cart'),
      ev('c', 2, 'pageview', '', 'https://x.test/pricing'),
    ];
    expect(reachedPerStep(steps, events)).toEqual([3, 2, 1]);
  });
});
