import { decideRecovery, expectedErrors, sameCommit } from './recovery';

const T = { minErrors: 3, minRequests: 20, minExpectedErrors: 5 };
const decide = (errors: number, requests: number | null, expected: number, interim = false) =>
  decideRecovery({ errors, requests, expectedErrors: expected, interim }, T);

describe('decideRecovery', () => {
  it('is not recovered once the same error repeats past the threshold', () => {
    expect(decide(3, 500, 50).outcome).toBe('not_recovered');
    expect(decide(40, null, 0).reason).toContain('40 errors with the same fingerprint');
  });

  it('concludes "not recovered" early, but never "recovered", in an interim check', () => {
    expect(decide(5, null, 0, true).outcome).toBe('not_recovered');
    expect(decide(0, 1000, 100, true).outcome).toBe('pending');
  });

  it('is recovered with zero errors over enough traffic', () => {
    const d = decide(0, 120, 0);
    expect(d.outcome).toBe('recovered');
    expect(d.reason).toContain('120 requests');
  });

  it('says when the traffic count hit the query cap', () => {
    expect(decide(0, 1000, 0).reason).toContain('at least 1000 requests');
  });

  it('is recovered without traffic data when the old rate should have produced errors', () => {
    expect(decide(0, null, 12).outcome).toBe('recovered');
    expect(decide(0, 3, 5).outcome).toBe('recovered');
  });

  it('is inconclusive with zero errors but no evidence of traffic', () => {
    const d = decide(0, 4, 1.2);
    expect(d.outcome).toBe('inconclusive');
    expect(d.reason).toContain('only 4 requests (need 20)');
    expect(decide(0, null, 0).reason).toContain('traffic is unknown');
  });

  it('leaves a few repeats below the threshold to a human', () => {
    const d = decide(1, 5000, 400);
    expect(d.outcome).toBe('inconclusive');
    expect(d.reason).toContain('1 error with the same fingerprint');
  });
});

describe('expectedErrors', () => {
  it('scales the hourly baseline to the window', () => {
    expect(expectedErrors(60, 30 * 60_000)).toBe(30);
    expect(expectedErrors(0.5, 30 * 60_000)).toBe(0.3);
  });
});

describe('sameCommit', () => {
  it('matches short and full shas of the same commit', () => {
    expect(sameCommit('abc1234', 'abc1234def5678abc1234def5678abc1234def56')).toBe(true);
    expect(sameCommit('ABC1234', 'abc1234')).toBe(true);
    expect(sameCommit('abc1234', 'abc9999')).toBe(false);
    expect(sameCommit('abc', 'abcdef0')).toBe(false); // too short to be unambiguous
  });
});
