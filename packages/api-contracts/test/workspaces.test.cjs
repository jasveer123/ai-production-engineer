const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, UUID, NOW, c } = require('./helpers.cjs');

test('createWorkspaceSchema needs 2 to 80 characters', () => {
  ok(c.createWorkspaceSchema, { name: 'Ac' });
  bad(c.createWorkspaceSchema, { name: 'A' });
  bad(c.createWorkspaceSchema, { name: 'x'.repeat(81) });
  assert.equal(parse(c.createWorkspaceSchema, { name: '  Acme ' }).name, 'Acme');
});

test('inviteMemberSchema and updateMemberRoleSchema validate roles', () => {
  ok(c.inviteMemberSchema, { email: 'a@b.co', role: 'viewer' });
  bad(c.inviteMemberSchema, { email: 'a@b.co', role: 'root' });
  bad(c.inviteMemberSchema, { email: 'nope', role: 'admin' });
  ok(c.updateMemberRoleSchema, { role: 'owner' });
  bad(c.updateMemberRoleSchema, { role: 'root' });
});

test('approvalPolicySchema excludes the viewer role', () => {
  for (const prMinRole of ['owner', 'admin', 'engineer']) ok(c.approvalPolicySchema, { prMinRole });
  bad(c.approvalPolicySchema, { prMinRole: 'viewer' });
});

test('severityRuleSchema and severityRulesSchema', () => {
  ok(c.severityRuleSchema, { severity: 'high' });
  ok(c.severityRuleSchema, {
    severity: 'low',
    environment: 'prod',
    serviceName: 'api',
    errorType: 'E',
  });
  bad(c.severityRuleSchema, { severity: 'urgent' });
  bad(c.severityRuleSchema, { severity: 'low', environment: 'x'.repeat(41) });
  ok(c.severityRulesSchema, { rules: [] });
  bad(c.severityRulesSchema, { rules: Array.from({ length: 51 }, () => ({ severity: 'low' })) });
});

test('workspaceLimitsSchema allows null limits and rejects out-of-range values', () => {
  ok(c.workspaceLimitsSchema, { monthlyAiBudgetUsd: null, maxConcurrentInvestigations: null });
  ok(c.workspaceLimitsSchema, { monthlyAiBudgetUsd: 10.5, maxConcurrentInvestigations: 3 });
  bad(c.workspaceLimitsSchema, { monthlyAiBudgetUsd: -1, maxConcurrentInvestigations: 3 });
  bad(c.workspaceLimitsSchema, { monthlyAiBudgetUsd: 1, maxConcurrentInvestigations: 0 });
  bad(c.workspaceLimitsSchema, { monthlyAiBudgetUsd: 1, maxConcurrentInvestigations: 1.5 });
});

test('auditQuerySchema defaults the limit and validates filters', () => {
  assert.equal(parse(c.auditQuerySchema, {}).limit, 50);
  ok(c.auditQuerySchema, { actorId: UUID, outcome: 'denied', before: NOW, limit: 200 });
  for (const outcome of c.AUDIT_OUTCOMES) ok(c.auditQuerySchema, { outcome });
  bad(c.auditQuerySchema, { outcome: 'maybe' });
  bad(c.auditQuerySchema, { actorId: 'x' });
  bad(c.auditQuerySchema, { limit: 201 });
});
