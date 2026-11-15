import { browserEvent, envelope, pythonEvent } from './fixtures/sentry-fixtures';
import { compareReleases, fingerprintOf, isRegression } from './grouping';
import { eventPayload, parseEnvelope, parseSentryAuth } from './sentry-envelope';
import { normalizeSentryEvent, stackLines } from './sentry-event';

describe('sentry envelopes', () => {
  it('parses items with and without a length header, including binary attachments', () => {
    const json = JSON.stringify(browserEvent);
    const binary = Buffer.from([0x00, 0x0a, 0xff, 0x0a]);
    const buf = envelope(
      [
        { header: { type: 'event', length: Buffer.byteLength(json) }, body: json },
        { header: { type: 'attachment', length: binary.length, filename: 'a.bin' }, body: binary },
        { header: { type: 'session' }, body: '{"sid":"x","status":"ok"}' },
      ],
      { event_id: browserEvent.event_id, sent_at: '2026-11-14T10:00:00Z' },
    );
    const parsed = parseEnvelope(buf);
    expect(parsed.header.event_id).toBe(browserEvent.event_id);
    expect(parsed.items.map((i) => i.type)).toEqual(['event', 'attachment', 'session']);
    expect(parsed.items[1]!.payload.equals(binary)).toBe(true);
    expect(eventPayload(parsed.items[0]!)?.event_id).toBe(browserEvent.event_id);
    expect(eventPayload(parsed.items[2]!)).toBeNull();
  });

  it('rejects broken envelopes and out-of-range lengths', () => {
    expect(() => parseEnvelope(Buffer.from('not json\n'))).toThrow();
    expect(() => parseEnvelope(Buffer.from('{}\n{"type":"event","length":999}\n{}'))).toThrow();
  });

  it('reads the key from the auth header', () => {
    expect(parseSentryAuth('Sentry sentry_version=7, sentry_client=x/1, sentry_key=abc123')).toBe(
      'abc123',
    );
    expect(parseSentryAuth(undefined)).toBeNull();
  });
});

describe('sentry events', () => {
  it('maps a browser event with chained exceptions, breadcrumbs, user and session link', () => {
    const o = normalizeSentryEvent(browserEvent);
    expect(o.errorType).toBe('TypeError');
    expect(o.title).toBe("TypeError: Cannot read properties of undefined (reading 'total')");
    expect(o.exceptions).toHaveLength(2);
    expect(o.exceptions[1]!.frames.at(-1)!.function).toBe('computeTotal');
    expect(o.breadcrumbs).toHaveLength(2);
    expect(o.userKey).toBe('u_42');
    expect(o.rumSessionKey).toBe('a1b2c3d4e5f6a7b8c9d0e1f2');
    expect(o.tags.auth_token).toBe('[REDACTED]');
    expect(o.request).toEqual({ url: 'https://shop.test/cart', method: null });
    expect(o.occurredAt.toISOString()).toBe('2026-11-14T00:00:00.123Z');
    expect(stackLines(o)[0]).toContain('computeTotal');
  });

  it('maps a python event with code context and list tags, without local variables', () => {
    const o = normalizeSentryEvent(pythonEvent);
    expect(o.errorType).toBe('ZeroDivisionError');
    expect(o.environment).toBe('staging');
    expect(o.tags).toEqual({ url: '/orders/7', handled: 'no' });
    const frame = o.exceptions[0]!.frames[1]!;
    expect(frame.file).toBe('/app/orders/views.py');
    expect(frame.context?.line).toContain('sum(items)');
    expect(JSON.stringify(o)).not.toContain('hunter2');
  });

  it('handles message-only events', () => {
    const o = normalizeSentryEvent({ event_id: 'x', message: { formatted: 'Disk almost full' } });
    expect(o.title).toBe('Message: Disk almost full');
  });
});

describe('grouping', () => {
  it('ignores line numbers and bundle hashes but honours custom fingerprints', () => {
    const a = normalizeSentryEvent(browserEvent);
    const moved = structuredClone(browserEvent);
    moved.exception.values[1]!.stacktrace.frames[2]!.colno = 999;
    moved.exception.values[1]!.stacktrace.frames[2]!.filename =
      'https://shop.test/assets/app.77aa00bb.js';
    expect(fingerprintOf('app', normalizeSentryEvent(moved))).toBe(fingerprintOf('app', a));
    expect(fingerprintOf('other', a)).not.toBe(fingerprintOf('app', a));
    const custom = normalizeSentryEvent({ ...browserEvent, fingerprint: ['payments-down'] });
    const custom2 = normalizeSentryEvent({ ...pythonEvent, fingerprint: ['payments-down'] });
    expect(fingerprintOf('app', custom)).toBe(fingerprintOf('app', custom2));
    const extended = normalizeSentryEvent({
      ...browserEvent,
      fingerprint: ['{{ default }}', 'eu'],
    });
    expect(fingerprintOf('app', extended)).not.toBe(fingerprintOf('app', a));
  });

  it('orders releases and decides regressions', () => {
    expect(compareReleases('shop@1.10.0', 'shop@1.9.3')).toBe(1);
    expect(compareReleases('v2.0', '2.0.0')).toBe(0);
    expect(compareReleases('abc123', 'def456')).toBeNull();
    expect(isRegression('1.4.0', '1.4.0', () => null)).toBe(true);
    expect(isRegression('1.4.0', '1.5.0', () => null)).toBe(true);
    expect(isRegression('1.4.0', '1.3.9', () => null)).toBe(false);
    const seen = new Map([
      ['abc123', new Date(1000)],
      ['def456', new Date(2000)],
    ]);
    expect(isRegression('def456', 'abc123', (r) => seen.get(r) ?? null)).toBe(false);
    expect(isRegression('abc123', 'def456', (r) => seen.get(r) ?? null)).toBe(true);
    expect(isRegression(null, '1.0.0', () => null)).toBe(true);
  });
});
