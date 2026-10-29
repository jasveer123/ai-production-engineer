import { sign, verifySignature } from './webhook-signature';

describe('verifySignature', () => {
  const secret = 'whsec_test';
  const body = Buffer.from('{"service":"api"}');
  const now = 1_800_000_000;
  const ts = String(now);

  it('accepts a correct signature inside the time window', () => {
    expect(verifySignature(secret, ts, sign(secret, ts, body), body, now)).toEqual({ ok: true });
  });

  it('rejects a wrong secret, a tampered body and missing headers', () => {
    expect(verifySignature(secret, ts, sign('other', ts, body), body, now)).toMatchObject({
      reason: 'bad_signature',
    });
    expect(
      verifySignature(secret, ts, sign(secret, ts, body), Buffer.from('{}'), now),
    ).toMatchObject({
      reason: 'bad_signature',
    });
    expect(verifySignature(secret, undefined, undefined, body, now)).toMatchObject({
      reason: 'missing_headers',
    });
  });

  it('rejects old timestamps so captured requests cannot be replayed later', () => {
    const old = String(now - 600);
    expect(verifySignature(secret, old, sign(secret, old, body), body, now)).toMatchObject({
      reason: 'stale_timestamp',
    });
  });
});
