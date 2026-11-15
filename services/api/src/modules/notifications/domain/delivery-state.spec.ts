import { afterSend, backoffMs, callbackState, MAX_ATTEMPTS, retryDelayMs } from './delivery-state';
import { twilioSignature, verifyTwilioSignature } from './twilio-signature';
import { smtpFailure } from '../../auth/infrastructure/mailer.service';

const now = new Date('2026-11-14T00:00:00Z');
const ctx = (attempts: number, channel = 'sms') => ({
  attempts,
  maxAttempts: MAX_ATTEMPTS,
  channel,
  now,
  random: () => 1,
});

describe('delivery state machine', () => {
  it('records provider acceptance with the message id, never as delivered', () => {
    const t = afterSend({ kind: 'accepted', providerMessageId: 'SM1', status: 201 }, ctx(1));
    expect(t).toMatchObject({ state: 'provider_accepted', providerMessageId: 'SM1', sentAt: now });
    expect(t.deliveredAt).toBeNull();
  });

  it('marks a 2xx from a webhook receiver as delivered', () => {
    expect(afterSend({ kind: 'delivered', status: 200 }, ctx(1, 'webhook')).state).toBe(
      'delivered',
    );
  });

  it('fails permanently without retry on a permanent error', () => {
    const t = afterSend(
      { kind: 'permanent', error: 'Receiver responded 410', status: 410 },
      ctx(1),
    );
    expect(t).toMatchObject({ state: 'failed_permanent', nextAttemptAt: null, sentAt: null });
  });

  it('waits and retries a transient failure until the attempts run out', () => {
    const transient = { kind: 'transient', error: '503', status: 503, retryAfterMs: null } as const;
    const first = afterSend(transient, ctx(1));
    expect(first.state).toBe('retry_wait');
    expect(first.nextAttemptAt!.getTime()).toBe(now.getTime() + 30_000);
    const last = afterSend(transient, ctx(MAX_ATTEMPTS));
    expect(last.state).toBe('failed_permanent');
    expect(last.error).toContain(`Gave up after ${MAX_ATTEMPTS} attempts`);
  });

  it('respects Retry-After when it is longer than the backoff', () => {
    const t = afterSend(
      { kind: 'transient', error: '429', status: 429, retryAfterMs: 120_000 },
      ctx(1),
    );
    expect(t.nextAttemptAt!.getTime()).toBe(now.getTime() + 120_000);
  });

  it('leaves a timeout as outcome_unknown unless the channel can dedupe a resend', () => {
    expect(afterSend({ kind: 'timeout', error: 't' }, ctx(1, 'sms')).state).toBe('outcome_unknown');
    expect(afterSend({ kind: 'timeout', error: 't' }, ctx(1, 'email')).state).toBe('retry_wait');
  });

  it('backs off exponentially with jitter between half and the full ceiling', () => {
    expect(backoffMs(1, () => 0)).toBe(15_000);
    expect(backoffMs(1, () => 1)).toBe(30_000);
    expect(backoffMs(3, () => 1)).toBe(120_000);
    expect(backoffMs(20, () => 1)).toBe(30 * 60_000);
    expect(retryDelayMs(1, 10 * 3600_000, () => 1)).toBe(3600_000);
  });

  it('applies provider callbacks without regressing a final state', () => {
    expect(callbackState('provider_accepted', 'delivered')).toBe('delivered');
    expect(callbackState('provider_accepted', 'undelivered')).toBe('failed_permanent');
    expect(callbackState('outcome_unknown', 'completed')).toBe('delivered');
    expect(callbackState('provider_accepted', 'sent')).toBeNull();
    expect(callbackState('delivered', 'failed')).toBeNull();
    expect(callbackState('cancelled', 'delivered')).toBeNull();
  });
});

describe('Twilio signature', () => {
  it('verifies the documented HMAC-SHA1 over url and sorted params', () => {
    const params = { MessageStatus: 'delivered', MessageSid: 'SM1', AccountSid: 'AC1' };
    const url = 'https://api.example.com/notifications/twilio/status';
    const sig = twilioSignature('token', url, params);
    expect(verifyTwilioSignature('token', url, params, sig)).toBe(true);
    expect(verifyTwilioSignature('other', url, params, sig)).toBe(false);
    expect(verifyTwilioSignature('token', url, { ...params, MessageStatus: 'failed' }, sig)).toBe(
      false,
    );
    expect(verifyTwilioSignature('token', url, params, undefined)).toBe(false);
  });
});

describe('SMTP failure classification', () => {
  it('treats 4xx replies and socket errors as transient, 5xx as permanent', () => {
    expect(smtpFailure({ message: 'busy', responseCode: 421 })).toMatchObject({ transient: true });
    expect(smtpFailure({ message: 'no such user', responseCode: 550 })).toMatchObject({
      transient: false,
    });
    expect(smtpFailure({ message: 'refused', code: 'ECONNECTION' })).toMatchObject({
      transient: true,
    });
    expect(smtpFailure({ message: 'bad auth', code: 'EAUTH' })).toMatchObject({ transient: false });
  });
});
