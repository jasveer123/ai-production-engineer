import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'x-ape-signature';
export const TIMESTAMP_HEADER = 'x-ape-timestamp';

export const MAX_CLOCK_SKEW_SECONDS = 300;

export type SignatureCheck =
  { ok: true } | { ok: false; reason: 'missing_headers' | 'stale_timestamp' | 'bad_signature' };

export function sign(secret: string, timestamp: string, body: Buffer | string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
}

export function verifySignature(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: Buffer,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) {
    return { ok: false, reason: 'missing_headers' };
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: 'stale_timestamp' };
  }
  const expected = Buffer.from(sign(secret, timestamp, rawBody));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad_signature' };
  }
  return { ok: true };
}
