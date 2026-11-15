import type { MissingDataPolicy } from '@ape/api-contracts';
import { decide, signalOf, type SeriesState, type Signal, type Timing } from './alert-decision';

const T0 = new Date('2026-11-14T12:00:00Z');
const later = (sec: number) => new Date(T0.getTime() + sec * 1000);
const st = (state: SeriesState['state'], pendingSince: Date | null = null): SeriesState => ({
  state,
  since: T0,
  pendingSince,
});
const timing = (missingData: MissingDataPolicy = 'keep', confirm = 0, recover = 0): Timing => ({
  confirmationSeconds: confirm,
  recoverySeconds: recover,
  missingData,
});

describe('decide: missing-data matrix', () => {
  const cases: [MissingDataPolicy, SeriesState['state'], SeriesState['state'], string | null][] = [
    ['alert', 'ok', 'firing', 'fire'],
    ['alert', 'firing', 'firing', null],
    ['ok', 'ok', 'ok', null],
    ['ok', 'firing', 'ok', 'resolve'],
    ['keep', 'ok', 'ok', null],
    ['keep', 'firing', 'firing', null],
    ['keep', 'pending', 'pending', null],
  ];
  it.each(cases)('policy %s from %s -> %s (%s)', (policy, from, to, transition) => {
    const d = decide(st(from, T0), 'no_data', timing(policy), later(10));
    expect(d.next.state).toBe(to);
    expect(d.transition).toBe(transition);
  });
});

describe('decide: confirmation and recovery', () => {
  const t = timing('keep', 60, 120);
  it('waits for the confirmation period before firing', () => {
    const first = decide(st('ok'), 'breach', t, T0);
    expect(first.next.state).toBe('pending');
    expect(decide(first.next, 'breach', t, later(30)).transition).toBeNull();
    expect(decide(first.next, 'breach', t, later(60)).transition).toBe('fire');
  });
  it('cancels a pending breach when the value recovers', () => {
    expect(decide(st('pending', T0), 'ok', t, later(10)).next.state).toBe('ok');
  });
  it('waits for the recovery period before resolving and re-fires without a new incident', () => {
    const rec = decide(st('firing'), 'ok', t, T0);
    expect(rec.next.state).toBe('recovering');
    expect(decide(rec.next, 'breach', t, later(30))).toMatchObject({
      next: { state: 'firing' },
      transition: null,
    });
    expect(decide(rec.next, 'ok', t, later(120)).transition).toBe('resolve');
  });
  it.each<Signal>(['error', 'warming_up'])('%s never changes state', (signal) => {
    expect(decide(st('firing'), signal, timing('ok'), T0)).toEqual({
      next: st('firing'),
      transition: null,
    });
  });
});

describe('signalOf', () => {
  it('threshold: null is no data, never zero', () => {
    const c = { type: 'threshold', operator: 'below', threshold: 1 } as const;
    expect(signalOf([null], c).signal).toBe('no_data');
    expect(signalOf([0], c).signal).toBe('breach');
  });
  it('relative change against the previous window', () => {
    const c = { type: 'relative', operator: 'above', threshold: 50 } as const;
    expect(signalOf([100, 160], c).signal).toBe('breach');
    expect(signalOf([100, 140], c).signal).toBe('ok');
    expect(signalOf([null, 140], c).signal).toBe('no_data');
  });
  it('anomaly warms up, then compares with the rolling baseline', () => {
    const c = { type: 'anomaly', operator: 'above', threshold: 3 } as const;
    expect(signalOf([10, 11, 50], c).signal).toBe('warming_up');
    const base = Array.from({ length: 24 }, (_, i) => 10 + (i % 3));
    expect(signalOf([...base, 11], c).signal).toBe('ok');
    expect(signalOf([...base, 30], c).signal).toBe('breach');
  });
});
