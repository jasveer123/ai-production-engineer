import { reachedPerStep } from './funnel';

let seq = 0;
const ev = (
  sessionId: string,
  ts: number,
  type: string,
  name: string,
  url: string | null = null,
  userId: string | null = null,
) => ({ sessionId, ts, type, name, url, userId, seq: ++seq });

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

  it('needs a distinct event for each repeated adjacent step', () => {
    const twice = [
      { kind: 'event' as const, match: 'add_to_cart' },
      { kind: 'event' as const, match: 'add_to_cart' },
    ];
    expect(reachedPerStep(twice, [ev('a', 5, 'custom', 'add_to_cart')])).toEqual([1, 0]);
    expect(
      reachedPerStep(twice, [
        ev('a', 5, 'custom', 'add_to_cart'),
        ev('a', 5, 'custom', 'add_to_cart'),
      ]),
    ).toEqual([1, 1]);
  });

  it('orders equal timestamps by arrival sequence', () => {
    const two = [
      { kind: 'event' as const, match: 'open' },
      { kind: 'event' as const, match: 'pay' },
    ];
    const pay = ev('a', 9, 'custom', 'pay');
    const open = ev('a', 9, 'custom', 'open');
    expect(reachedPerStep(two, [pay, open])).toEqual([1, 0]);
  });

  it('applies the conversion window from the first step', () => {
    const events = [
      ev('a', 0, 'pageview', '', 'https://x.test/pricing'),
      ev('a', 100, 'custom', 'add_to_cart'),
      ev('a', 5000, 'pageview', '', 'https://x.test/checkout/pay'),
    ];
    expect(reachedPerStep(steps, events, { unit: 'session', windowMs: 1000 })).toEqual([1, 1, 0]);
    expect(reachedPerStep(steps, events, { unit: 'session', windowMs: 10_000 })).toEqual([1, 1, 1]);
  });

  it('retries later starts inside the window', () => {
    const events = [
      ev('a', 0, 'pageview', '', 'https://x.test/pricing'),
      ev('a', 5000, 'pageview', '', 'https://x.test/pricing'),
      ev('a', 5100, 'custom', 'add_to_cart'),
    ];
    expect(reachedPerStep(steps, events, { unit: 'session', windowMs: 1000 })).toEqual([1, 1, 0]);
  });

  it('joins sessions of one user when the unit is user', () => {
    const events = [
      ev('a', 1, 'pageview', '', 'https://x.test/pricing', 'u1'),
      ev('b', 2, 'custom', 'add_to_cart', null, 'u1'),
    ];
    expect(reachedPerStep(steps, events, { unit: 'user', windowMs: null })).toEqual([1, 1, 0]);
    expect(reachedPerStep(steps, events, { unit: 'session', windowMs: null })).toEqual([1, 0, 0]);
  });
});
