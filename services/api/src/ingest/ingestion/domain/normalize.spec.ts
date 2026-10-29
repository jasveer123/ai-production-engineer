import trace from '../../../../test/fixtures/jaeger-trace-s1.json';
import { extractError, type JaegerTrace } from '../infrastructure/jaeger';
import {
  errorFingerprint,
  frameSignature,
  messageTemplate,
  normalize,
  PermanentIngestError,
} from './normalize';

const s1 = trace as unknown as JaegerTrace;

describe('extractError', () => {
  it('pulls the exception, route and environment from a real demo-shop trace', () => {
    const e = extractError(s1, 'demo-shop-api');
    expect(e).toMatchObject({
      traceId: s1.traceID,
      serviceName: 'demo-shop-api',
      environment: 'production',
      httpRoute: '/checkout',
      httpStatus: 500,
      exceptionType: 'TypeError',
      exceptionMessage: "Cannot read properties of undefined (reading 'percentOff')",
    });
    expect(e!.stack[0]).toContain('CheckoutService.discountV2');
  });

  it('ignores handled client errors such as a 402 card decline', () => {
    const declined = structuredClone(s1);
    for (const span of declined.spans) {
      for (const t of span.tags) if (t.key === 'http.response.status_code') t.value = 402;
    }
    expect(extractError(declined, 'demo-shop-api')).toBeNull();
  });

  it('ignores traces from other services', () => {
    expect(extractError(s1, 'someone-else')).toBeNull();
  });

  it('turns a 5xx without an exception into an HTTP error event', () => {
    const t: JaegerTrace = {
      traceID: 'a'.repeat(32),
      processes: { p1: { serviceName: 'svc', tags: [] } },
      spans: [
        {
          traceID: 'a'.repeat(32),
          spanID: 'b1',
          operationName: 'POST /checkout',
          startTime: 1_700_000_000_000_000,
          processID: 'p1',
          tags: [
            { key: 'span.kind', value: 'server' },
            { key: 'error', value: true },
            { key: 'http.route', value: '/checkout' },
            { key: 'http.response.status_code', value: 504 },
          ],
        },
      ],
    };
    expect(extractError(t, 'svc')).toMatchObject({
      exceptionType: 'HTTP 504',
      environment: 'unknown',
      httpStatus: 504,
    });
  });
});

describe('fingerprints', () => {
  const base = {
    serviceName: 'api',
    environment: 'production',
    errorType: 'TypeError',
    message: 'Order 123 failed for cart 9b2f4c1e-1111-4abc-8def-0123456789ab',
    topFrame: 'at CheckoutService.discountV2 (/app/api/src/services/checkout.ts:81:46)',
    route: '/checkout',
  };

  it('ignores ids, numbers and line numbers so one bug maps to one fingerprint', () => {
    const other = {
      ...base,
      message: 'Order 98765 failed for cart 00000000-2222-4abc-8def-0123456789ab',
      topFrame: 'at CheckoutService.discountV2 (/srv/build/api/src/services/checkout.ts:90:3)',
    };
    expect(errorFingerprint(other)).toBe(errorFingerprint(base));
  });

  it('separates different errors, services and environments', () => {
    const fp = errorFingerprint(base);
    expect(errorFingerprint({ ...base, errorType: 'RangeError' })).not.toBe(fp);
    expect(errorFingerprint({ ...base, environment: 'staging' })).not.toBe(fp);
    expect(errorFingerprint({ ...base, topFrame: 'at Other.fn (/a/b.ts:1:1)' })).not.toBe(fp);
  });

  it('templates messages and frames', () => {
    expect(messageTemplate('id 42 / abcdef0123456789')).toBe('id <n> / <hex>');
    expect(frameSignature('at async Foo.bar (/x/y/src/z.ts:10:2)')).toBe('Foo.bar src/z.ts');
  });
});

describe('normalize', () => {
  it('normalizes a deploy marker', () => {
    expect(
      normalize('deploy_webhook', {
        service: 'api',
        commit_sha: 'abc1234',
        env: 'production',
        version: '1.2.0',
      }),
    ).toMatchObject({ kind: 'deploy', serviceName: 'api', commitSha: 'abc1234', version: '1.2.0' });
  });

  it('rejects malformed and unknown payloads permanently', () => {
    expect(() => normalize('deploy_webhook', { service: 'api' })).toThrow(PermanentIngestError);
    expect(() => normalize('mystery', {})).toThrow(PermanentIngestError);
  });

  it('normalizes a Jaeger error into a titled, fingerprinted event', () => {
    const e = normalize('otel_jaeger', extractError(s1, 'demo-shop-api'));
    expect(e.kind).toBe('error');
    if (e.kind === 'error') {
      expect(e.title).toBe(
        "TypeError: Cannot read properties of undefined (reading 'percentOff') (/checkout)",
      );
      expect(e.fingerprint).toMatch(/^err:[0-9a-f]{32}$/);
    }
  });
});
