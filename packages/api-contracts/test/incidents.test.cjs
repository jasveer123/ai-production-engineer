const test = require('node:test');
const assert = require('node:assert/strict');
const { ok, bad, parse, UUID, NOW, c } = require('./helpers.cjs');

test('every incident status has a transition entry and valid targets', () => {
  assert.deepEqual(Object.keys(c.INCIDENT_TRANSITIONS).sort(), [...c.INCIDENT_STATUSES].sort());
  for (const targets of Object.values(c.INCIDENT_TRANSITIONS)) {
    for (const to of targets) ok(c.incidentStatusSchema, to);
  }
});

test('closed incidents can only be reopened as needs_attention', () => {
  for (const status of c.CLOSED_STATUSES) {
    assert.deepEqual(c.INCIDENT_TRANSITIONS[status], ['needs_attention']);
  }
});

test('severity and status schemas reject unknown values', () => {
  for (const s of c.SEVERITIES) ok(c.severitySchema, s);
  bad(c.severitySchema, 'urgent');
  bad(c.incidentStatusSchema, 'lost');
});

test('incidentListQuerySchema defaults the limit and accepts open/closed', () => {
  assert.equal(parse(c.incidentListQuerySchema, {}).limit, 50);
  ok(c.incidentListQuerySchema, { status: 'open' });
  ok(c.incidentListQuerySchema, {
    status: 'closed',
    severity: 'high',
    serviceId: UUID,
    before: NOW,
  });
  bad(c.incidentListQuerySchema, { status: 'bogus' });
  bad(c.incidentListQuerySchema, { limit: 101 });
});

test('createIncidentSchema defaults severity and bounds the title', () => {
  assert.equal(parse(c.createIncidentSchema, { title: 'Checkout down' }).severity, 'medium');
  bad(c.createIncidentSchema, { title: 'ab' });
  bad(c.createIncidentSchema, { title: 'x'.repeat(201) });
  bad(c.createIncidentSchema, { title: 'Checkout down', serviceId: 'x' });
});

test('transitionIncidentSchema requires a positive expected version', () => {
  ok(c.transitionIncidentSchema, { to: 'resolved', expectedVersion: 1 });
  bad(c.transitionIncidentSchema, { to: 'resolved', expectedVersion: 0 });
  bad(c.transitionIncidentSchema, { to: 'nowhere', expectedVersion: 1 });
});

test('incidentActionSchema and fixActionSchema', () => {
  for (const action of c.INCIDENT_ACTIONS) ok(c.incidentActionSchema, { action });
  bad(c.incidentActionSchema, { action: 'explode' });
  bad(c.incidentActionSchema, { action: 'dismiss', note: 'x'.repeat(2001) });
  for (const action of c.FIX_ACTIONS) ok(c.fixActionSchema, { action, note: 'why' });
  bad(c.fixActionSchema, { action: 'merge' });
});

test('hypothesisFeedbackSchema and qualityQuerySchema', () => {
  for (const verdict of c.HYPOTHESIS_VERDICTS)
    ok(c.hypothesisFeedbackSchema, { hypothesisId: UUID, verdict });
  bad(c.hypothesisFeedbackSchema, { hypothesisId: 'x', verdict: 'correct' });
  bad(c.hypothesisFeedbackSchema, { hypothesisId: UUID, verdict: 'maybe' });
  bad(c.hypothesisFeedbackSchema, { hypothesisId: UUID, verdict: 'wrong', note: 'x'.repeat(1001) });
  assert.equal(parse(c.qualityQuerySchema, {}).days, 30);
  bad(c.qualityQuerySchema, { days: 366 });
});

test('TRAFFIC_COUNT_CAP is a positive integer', () => {
  assert.ok(Number.isInteger(c.TRAFFIC_COUNT_CAP) && c.TRAFFIC_COUNT_CAP > 0);
});
