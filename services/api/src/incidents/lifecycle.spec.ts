import { INCIDENT_STATUSES } from '@ape/api-contracts';
import { canTransition, isClosed, severityFor } from './lifecycle';

describe('incident lifecycle', () => {
  it('follows the main path from detected to resolved', () => {
    const path = [
      'detected',
      'investigating',
      'fix_proposed',
      'validation',
      'awaiting_review',
      'monitoring',
      'resolved',
    ] as const;
    for (let i = 0; i < path.length - 1; i++)
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it('rejects skipping steps and staying in place', () => {
    expect(canTransition('detected', 'resolved')).toBe(false);
    expect(canTransition('validation', 'monitoring')).toBe(false);
    for (const s of INCIDENT_STATUSES) expect(canTransition(s, s)).toBe(false);
  });

  it('can reopen closed incidents and knows which are closed', () => {
    expect(canTransition('resolved', 'needs_attention')).toBe(true);
    expect(isClosed('resolved')).toBe(true);
    expect(isClosed('monitoring')).toBe(false);
  });
});

describe('severityFor', () => {
  const ev = { environment: 'production', serviceName: 'api', errorType: 'TypeError' };

  it('uses defaults: production is high, everything else medium', () => {
    expect(severityFor(undefined, ev)).toBe('high');
    expect(severityFor([], { ...ev, environment: 'staging' })).toBe('medium');
  });

  it('applies the first matching workspace rule', () => {
    const rules = [
      { serviceName: 'api', errorType: 'TypeError', severity: 'critical' as const },
      { environment: 'production', severity: 'low' as const },
    ];
    expect(severityFor(rules, ev)).toBe('critical');
    expect(severityFor(rules, { ...ev, errorType: 'Other' })).toBe('low');
  });
});
