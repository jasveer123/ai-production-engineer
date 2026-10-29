import { branchName, commitMessage, prBody, prTitle, type PrBodyInput } from './pr-body';

const input: PrBodyInput = {
  incident: {
    id: '964d3eed-f603-470a-82d2-4b6050c97228',
    title: "TypeError: Cannot read properties of undefined (reading 'percentOff') (/checkout)",
    severity: 'high',
    serviceName: 'demo-shop-api',
    environment: 'production',
    eventCount: 148,
  },
  dashboardUrl: 'http://localhost:3000/w/ws/incidents/964d3eed',
  hypothesis: {
    summary: 'discountV2 reads percentOff of undefined',
    rationale: 'stack frames',
    location: { file: 'api/src/services/checkout.ts', line: 81, symbol: 'discountV2' },
  },
  evidence: [
    {
      ref: 'E7',
      title: 'api/src/services/checkout.ts:81',
      sourceUrl: 'https://github.com/x/y/blob/sha/api/src/services/checkout.ts#L51-L111',
    },
  ],
  fix: {
    version: 1,
    explanation: 'Return 0 when no coupon is sent; reject unknown codes.',
    diffStat: { files: 1, additions: 3, deletions: 1 },
    baseCommitSha: 'b47fc03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    testPath: 'api/test/ape-regression-964d3eed.test.ts',
  },
  runs: [
    {
      kind: 'baseline',
      attempt: 0,
      status: 'passed',
      summary: { tests: 17, failures: 0, errors: 0 },
    },
    { kind: 'reproduction', attempt: 0, status: 'passed', summary: { reason: 'bug_reproduced' } },
    {
      kind: 'full_suite',
      attempt: 1,
      status: 'failed',
      summary: { tests: 19, failures: 1, errors: 0 },
    },
    {
      kind: 'full_suite',
      attempt: 2,
      status: 'passed',
      summary: { tests: 19, failures: 0, errors: 0 },
    },
  ],
  approver: 'jasveer@shop.local',
};

describe('PR text', () => {
  it('uses a deterministic branch name per incident and fix version', () => {
    expect(branchName(input.incident.id, 1)).toBe('ai-fix/incident-964d3eed-v1');
    expect(branchName(input.incident.id, 2)).toBe('ai-fix/incident-964d3eed-v2');
  });

  it('writes a reviewable body with root cause, evidence, validation and limitations', () => {
    const body = prBody(input);
    expect(body).toContain('## Root cause');
    expect(body).toContain('`api/src/services/checkout.ts:81` (discountV2)');
    expect(body).toContain('[api/src/services/checkout.ts:81](https://github.com');
    expect(body).toContain('| Full test suite with the patch | ✅ passed | 19/19 passed |');
    expect(body).not.toContain('19/18');
    expect(body).not.toContain('❌ failed | 18/19');
    expect(body).toContain('Nothing is merged or deployed automatically.');
    expect(body).toContain('approval by jasveer@shop.local');
  });

  it('keeps titles short and records the approver in the commit', () => {
    expect(prTitle(input).length).toBeLessThanOrEqual(95);
    expect(commitMessage(input)).toContain('Approved-by: jasveer@shop.local');
  });
});
