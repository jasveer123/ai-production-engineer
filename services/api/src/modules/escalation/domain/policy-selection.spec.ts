import type { StoredStep } from '../../../core/db/schema';
import { inTimeWindow, nextPosition, selectSteps, simplePolicySteps } from './policy-selection';

const step = (waitMinutes: number): StoredStep => ({
  waitMinutes,
  targets: [{ kind: 'everyone' }],
  channels: ['email'],
});

describe('branch selection', () => {
  const policy = {
    steps: [step(0)],
    branches: [
      {
        name: 'Checkout prod',
        when: { metadata: [{ key: 'service' as const, value: 'checkout' }] },
        steps: [step(1)],
      },
      { name: 'Critical', when: { minSeverity: 'critical' as const }, steps: [step(2)] },
    ],
  };
  const facts = (severity: string, service: string | null) => ({
    severity,
    attributes: { service, environment: 'production', source: 'monitor' },
  });
  const now = new Date('2026-11-14T10:00:00Z');

  it('takes the first matching branch', () => {
    expect(selectSteps(policy, facts('critical', 'Checkout'), now).branch).toBe('Checkout prod');
    expect(selectSteps(policy, facts('critical', 'search'), now).branch).toBe('Critical');
  });

  it('falls back to the main steps when no branch matches or metadata is missing', () => {
    expect(selectSteps(policy, facts('high', null), now)).toEqual({
      branch: null,
      steps: [step(0)],
    });
  });
});

describe('time windows', () => {
  const business = { days: [1, 2, 3, 4, 5], from: '09:00', to: '17:00', timezone: 'Asia/Kolkata' };

  it('evaluates in the policy timezone', () => {
    expect(inTimeWindow(business, new Date('2026-11-16T04:00:00Z'))).toBe(true);
    expect(inTimeWindow(business, new Date('2026-11-16T12:00:00Z'))).toBe(false);
    expect(inTimeWindow(business, new Date('2026-11-15T05:00:00Z'))).toBe(false);
  });

  it('handles windows that cross midnight, owned by the starting day', () => {
    const night = { days: [5], from: '22:00', to: '06:00', timezone: 'UTC' };
    expect(inTimeWindow(night, new Date('2026-11-13T23:00:00Z'))).toBe(true);
    expect(inTimeWindow(night, new Date('2026-11-14T05:00:00Z'))).toBe(true);
    expect(inTimeWindow(night, new Date('2026-11-15T05:00:00Z'))).toBe(false);
  });

  it('never matches an unknown timezone', () => {
    expect(inTimeWindow({ ...business, timezone: 'Nowhere/City' }, new Date())).toBe(false);
  });
});

describe('run progression', () => {
  const steps = [step(0), step(5)];

  it('moves to the next step with its delay', () => {
    expect(nextPosition({ stepIndex: 0, repeatsDone: 0, repeatCount: 0 }, steps)).toEqual({
      stepIndex: 1,
      repeatsDone: 0,
      waitMinutes: 5,
    });
  });

  it('repeats from the first step until the repeat count is used, then stops', () => {
    expect(nextPosition({ stepIndex: 1, repeatsDone: 0, repeatCount: 2 }, steps)).toEqual({
      stepIndex: 0,
      repeatsDone: 1,
      waitMinutes: 5,
    });
    expect(nextPosition({ stepIndex: 1, repeatsDone: 2, repeatCount: 2 }, steps)).toBeNull();
  });
});

describe('simple mode', () => {
  const primary = { kind: 'user' as const, userId: '00000000-0000-4000-8000-000000000001' };

  it('generates primary then whole team after the chosen delay', () => {
    expect(
      simplePolicySteps({ primary, channels: ['sms', 'email'], escalateAfterMinutes: 3 }),
    ).toEqual([
      { waitMinutes: 0, targets: [primary], channels: ['sms', 'email'] },
      { waitMinutes: 3, targets: [{ kind: 'everyone' }], channels: ['sms', 'email'] },
    ]);
  });

  it('notifies only the primary responder for "do nothing"', () => {
    expect(
      simplePolicySteps({ primary, channels: ['call'], escalateAfterMinutes: null }),
    ).toHaveLength(1);
  });
});
