import { planResponse, responseStateOf, type ResponseFacts } from './response';
import { buildCurlCommand } from './replay';

const at = new Date('2026-11-14T10:00:00Z');
const facts = (over: Partial<ResponseFacts> = {}): ResponseFacts => ({
  status: 'investigating',
  acknowledgedAt: null,
  resolvedAt: null,
  ...over,
});

describe('incident response lifecycle', () => {
  it('derives the state from existing rows without new columns', () => {
    expect(responseStateOf(facts())).toBe('open');
    expect(responseStateOf(facts({ acknowledgedAt: at }))).toBe('acknowledged');
    expect(responseStateOf(facts({ status: 'resolved' }))).toBe('resolved');
    expect(responseStateOf(facts({ status: 'closed_without_fix', acknowledgedAt: at }))).toBe(
      'resolved',
    );
    expect(responseStateOf(facts({ resolvedAt: at }))).toBe('resolved');
  });

  it('walks open, acknowledged, resolved and back through reopen', () => {
    expect(planResponse(facts(), 'acknowledge')).toMatchObject({ ok: true, to: 'acknowledged' });
    expect(planResponse(facts({ acknowledgedAt: at }), 'unacknowledge')).toMatchObject({
      ok: true,
      to: 'open',
    });
    expect(planResponse(facts({ acknowledgedAt: at }), 'resolve')).toMatchObject({
      ok: true,
      to: 'resolved',
    });
    expect(planResponse(facts({ status: 'resolved', resolvedAt: at }), 'reopen')).toEqual({
      ok: true,
      to: 'open',
      aiStatus: 'needs_attention',
    });
  });

  it('resolves straight from open without acknowledging', () => {
    expect(planResponse(facts(), 'resolve')).toMatchObject({ ok: true, to: 'resolved' });
  });

  it('closes the AI status on a human resolution even mid-repair', () => {
    expect(planResponse(facts({ status: 'monitoring' }), 'resolve')).toMatchObject({
      aiStatus: 'resolved',
    });
    expect(planResponse(facts({ status: 'validation' }), 'resolve')).toMatchObject({
      aiStatus: 'closed_without_fix',
    });
  });

  it('refuses transitions that do not fit the current state', () => {
    expect(planResponse(facts({ acknowledgedAt: at }), 'acknowledge')).toMatchObject({ ok: false });
    expect(planResponse(facts({ status: 'resolved' }), 'acknowledge')).toMatchObject({
      ok: false,
      code: 'already_resolved',
    });
    expect(planResponse(facts(), 'unacknowledge')).toMatchObject({ ok: false });
    expect(planResponse(facts(), 'reopen')).toMatchObject({ ok: false });
    expect(planResponse(facts({ resolvedAt: at, status: 'resolved' }), 'resolve')).toMatchObject({
      ok: false,
    });
  });

  it('keeps an acknowledgement when the AI pipeline fails or changes its status', () => {
    for (const status of ['needs_attention', 'validation_failed', 'detected'] as const)
      expect(responseStateOf(facts({ status, acknowledgedAt: at }))).toBe('acknowledged');
  });
});

describe('replay command', () => {
  it('builds a curl command and never prints secrets', () => {
    const cmd = buildCurlCommand({
      url: 'https://shop.example.com/health?a=1',
      method: 'post',
      headers: [
        { name: 'Authorization', value: 'Bearer s3cret' },
        { name: 'X-Trace', value: "it's" },
      ],
      body: '{"ping":true}',
      timeoutSeconds: 30,
      basicAuthUser: 'ops',
    });
    expect(cmd).toBe(
      `curl -i -X POST -L --max-time 30 -H 'Authorization: <redacted>' -H 'X-Trace: it'\\''s' -u 'ops:<redacted>' --data-raw '{"ping":true}' 'https://shop.example.com/health?a=1'`,
    );
    expect(cmd).not.toContain('s3cret');
  });

  it('defaults to a plain GET', () => {
    expect(buildCurlCommand({ url: 'https://a.example' })).toBe("curl -i -L 'https://a.example'");
  });
});
