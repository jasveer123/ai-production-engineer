import { decideTransition, type StateSnapshot } from './transition';
import { inMaintenance } from './maintenance';

const policy = {
  intervalSeconds: 180,
  confirmationSeconds: 60,
  recoverySeconds: 120,
  inMaintenance: false,
};
const t0 = new Date('2026-11-14T10:00:00Z');
const at = (s: number) => new Date(t0.getTime() + s * 1000);
const snap = (state: StateSnapshot['state'], f: string | null = null, p: string | null = null) => ({
  state,
  failingSince: f,
  passingSince: p,
});

describe('decideTransition', () => {
  it('marks a passing pending monitor up without a transition', () => {
    const d = decideTransition(snap('pending'), true, t0, policy);
    expect(d).toMatchObject({ state: 'up', transition: null, nextDelaySeconds: 180 });
  });

  it('waits for the confirmation period and re-checks sooner', () => {
    const d = decideTransition(snap('up'), false, t0, policy);
    expect(d).toMatchObject({ state: 'up', transition: null, failingSince: t0.toISOString() });
    expect(d.nextDelaySeconds).toBe(60);
  });

  it('opens once the failure outlasts the confirmation period', () => {
    const d = decideTransition(snap('up', t0.toISOString()), false, at(61), policy);
    expect(d).toMatchObject({ state: 'down', transition: 'down' });
  });

  it('opens immediately with no confirmation period', () => {
    const d = decideTransition(snap('up'), false, t0, { ...policy, confirmationSeconds: 0 });
    expect(d.transition).toBe('down');
  });

  it('forgets a failure streak when a check passes before confirmation', () => {
    const d = decideTransition(snap('up', t0.toISOString()), true, at(30), policy);
    expect(d).toMatchObject({ state: 'up', failingSince: null, transition: null });
  });

  it('never re-announces down while already down', () => {
    const d = decideTransition(snap('down', t0.toISOString()), false, at(500), policy);
    expect(d).toMatchObject({ state: 'down', transition: null });
  });

  it('stays down until the recovery period has passed', () => {
    const first = decideTransition(snap('down', t0.toISOString()), true, at(10), policy);
    expect(first).toMatchObject({
      state: 'down',
      transition: null,
      passingSince: at(10).toISOString(),
    });
    const done = decideTransition(snap('down', null, first.passingSince), true, at(131), policy);
    expect(done).toMatchObject({ state: 'up', transition: 'up' });
  });

  it('restarts recovery when a check fails during it', () => {
    const d = decideTransition(snap('down', null, t0.toISOString()), false, at(60), policy);
    expect(d).toMatchObject({ state: 'down', passingSince: null, transition: null });
  });

  it('does not open during maintenance', () => {
    const d = decideTransition(snap('up', t0.toISOString()), false, at(500), {
      ...policy,
      inMaintenance: true,
    });
    expect(d).toMatchObject({ state: 'up', transition: null, failingSince: null });
  });
});

describe('inMaintenance', () => {
  const w = { from: '22:00', to: '02:00', timezone: 'Asia/Kolkata', weekdays: [5] };

  it('is false without a window', () => expect(inMaintenance(null, t0)).toBe(false));

  it('handles a same-day window in the given zone', () => {
    const day = { from: '15:00', to: '16:00', timezone: 'Asia/Kolkata', weekdays: [6] };
    expect(inMaintenance(day, new Date('2026-11-14T09:45:00Z'))).toBe(true);
    expect(inMaintenance(day, new Date('2026-11-14T10:45:00Z'))).toBe(false);
  });

  it('assigns the after-midnight part of an overnight window to its start day', () => {
    expect(inMaintenance(w, new Date('2026-11-13T17:00:00Z'))).toBe(true);
    expect(inMaintenance(w, new Date('2026-11-13T19:00:00Z'))).toBe(true);
    expect(inMaintenance(w, new Date('2026-11-14T19:00:00Z'))).toBe(false);
  });
});
