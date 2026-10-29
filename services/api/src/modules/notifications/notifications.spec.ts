import {
  maskTarget,
  notificationTypeFor,
  severityAtLeast,
  slackMessage,
  webhookPayload,
  type Notification,
} from './domain/messages';
import { checkOutboundUrl, isPrivateAddress, UnsafeUrlError } from './infrastructure/outbound-url';

const n: Notification = {
  type: 'incident.detected',
  key: 'evt:1',
  occurredAt: '2026-10-20T00:00:00.000Z',
  summary: 'Incident detected',
  url: 'http://localhost:3000/w/ws/incidents/i1',
  incident: {
    id: 'i1',
    workspaceId: 'ws',
    title: 'TypeError: <!channel> promo is undefined',
    severity: 'high',
    status: 'detected',
    serviceName: 'shop-api',
    environment: 'production',
  },
};

describe('notificationTypeFor', () => {
  it('maps creation and the status changes people care about', () => {
    expect(notificationTypeFor({ kind: 'created', attributes: {} })).toBe('incident.detected');
    const to = (s: string) => notificationTypeFor({ kind: 'status_change', attributes: { to: s } });
    expect(to('awaiting_review')).toBe('review.requested');
    expect(to('needs_attention')).toBe('incident.needs_attention');
    expect(to('resolved')).toBe('incident.resolved');
    expect(to('verification_inconclusive')).toBe('verification.inconclusive');
    expect(to('validation')).toBeNull();
    expect(notificationTypeFor({ kind: 'error', attributes: {} })).toBeNull();
  });
});

describe('severityAtLeast', () => {
  it('orders critical > high > medium > low', () => {
    expect(severityAtLeast('critical', 'high')).toBe(true);
    expect(severityAtLeast('high', 'high')).toBe(true);
    expect(severityAtLeast('medium', 'high')).toBe(false);
    expect(severityAtLeast('low', 'low')).toBe(true);
  });
});

describe('messages', () => {
  it('escapes telemetry text so it cannot mention @channel or inject links in Slack', () => {
    const msg = JSON.stringify(slackMessage(n));
    expect(msg).not.toContain('<!channel>');
    expect(msg).toContain('&lt;!channel&gt;');
    expect(msg).toContain('New high incident in shop-api (production)');
  });

  it('sends metadata only in webhook payloads', () => {
    const body = webhookPayload(n);
    expect(body).toMatchObject({ id: 'evt:1', type: 'incident.detected' });
    expect(Object.keys(body.incident).sort()).toEqual(
      ['environment', 'id', 'service', 'severity', 'status', 'title', 'url'].sort(),
    );
  });

  it('masks the credential part of a Slack webhook URL', () => {
    expect(maskTarget('slack', 'https://hooks.slack.com/services/T01/B02/secretXYZ')).toBe(
      'hooks.slack.com/services/T01/…',
    );
    expect(maskTarget('webhook', 'https://hooks.example.com/ape?token=abc')).toBe(
      'https://hooks.example.com/ape',
    );
  });
});

describe('outbound URL guard', () => {
  const strict = (resolved: string[]) => ({
    allowPrivate: false,
    resolve: () => Promise.resolve(resolved),
  });

  it('recognises private, loopback, link-local and metadata addresses', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1'])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])
      expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111'])
      expect(isPrivateAddress(ip)).toBe(false);
  });

  it('rejects http, embedded credentials and internal targets in production', async () => {
    await expect(
      checkOutboundUrl('http://example.com/x', strict(['93.184.216.34'])),
    ).rejects.toThrow(UnsafeUrlError);
    await expect(
      checkOutboundUrl('https://user:pw@example.com/x', strict(['93.184.216.34'])),
    ).rejects.toThrow(/Credentials/);
    await expect(
      checkOutboundUrl('https://internal.example.com/x', strict(['10.0.0.5'])),
    ).rejects.toThrow(/private or internal/);
    await expect(
      checkOutboundUrl('https://169.254.169.254/latest/meta-data', strict([])),
    ).rejects.toThrow(/private or internal/);
  });

  it('accepts public https targets, and local receivers in development', async () => {
    await expect(
      checkOutboundUrl('https://hooks.example.com/ape', strict(['93.184.216.34'])),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      checkOutboundUrl('http://localhost:9999/hook', { allowPrivate: true }),
    ).resolves.toBeInstanceOf(URL);
  });
});
