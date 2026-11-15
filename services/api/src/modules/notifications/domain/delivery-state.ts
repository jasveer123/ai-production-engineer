import type { DeliveryChannel, DeliveryState } from '@ape/api-contracts';

export type SendOutcome =
  | { kind: 'accepted'; providerMessageId: string | null; status: number | null }
  | { kind: 'delivered'; status: number | null }
  | { kind: 'transient'; error: string; status: number | null; retryAfterMs: number | null }
  | { kind: 'permanent'; error: string; status: number | null }
  | { kind: 'timeout'; error: string };

export interface Transition {
  state: DeliveryState;
  nextAttemptAt: Date | null;
  providerMessageId: string | null;
  responseStatus: number | null;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
}

export const MAX_ATTEMPTS = 5;
export const LEASE_MS = 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const MAX_RETRY_AFTER_MS = 60 * 60_000;

export const FINAL_STATES: readonly DeliveryState[] = [
  'delivered',
  'failed_permanent',
  'cancelled',
];
export const DUE_STATES: readonly DeliveryState[] = ['queued', 'retry_wait'];

/** Channels whose receivers can dedupe a resend (Resend idempotency key, signed webhook event id). */
export const IDEMPOTENT_CHANNELS: readonly DeliveryChannel[] = ['email', 'webhook'];
export const isIdempotent = (channel: string) =>
  (IDEMPOTENT_CHANNELS as readonly string[]).includes(channel);

export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export function retryDelayMs(
  attempt: number,
  retryAfterMs: number | null,
  random: () => number = Math.random,
): number {
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(backoffMs(attempt, random), retryAfterMs ?? 0));
}

interface SendContext {
  attempts: number;
  maxAttempts: number;
  channel: string;
  now: Date;
  random?: () => number;
}

const base = (): Transition => ({
  state: 'failed_permanent',
  nextAttemptAt: null,
  providerMessageId: null,
  responseStatus: null,
  error: null,
  sentAt: null,
  deliveredAt: null,
});

function retryOrGiveUp(
  ctx: SendContext,
  error: string,
  status: number | null,
  retryAfter: number | null,
): Transition {
  if (ctx.attempts >= ctx.maxAttempts)
    return {
      ...base(),
      responseStatus: status,
      error: `Gave up after ${ctx.attempts} attempts: ${error}`.slice(0, 500),
    };
  const delay = retryDelayMs(ctx.attempts, retryAfter, ctx.random);
  return {
    ...base(),
    state: 'retry_wait',
    nextAttemptAt: new Date(ctx.now.getTime() + delay),
    responseStatus: status,
    error,
  };
}

/** `ctx.attempts` already counts the attempt that produced `outcome`. */
export function afterSend(outcome: SendOutcome, ctx: SendContext): Transition {
  const now = ctx.now;
  switch (outcome.kind) {
    case 'accepted':
      return {
        ...base(),
        state: 'provider_accepted',
        providerMessageId: outcome.providerMessageId,
        responseStatus: outcome.status,
        sentAt: now,
      };
    case 'delivered':
      return {
        ...base(),
        state: 'delivered',
        responseStatus: outcome.status,
        sentAt: now,
        deliveredAt: now,
      };
    case 'permanent':
      return { ...base(), responseStatus: outcome.status, error: outcome.error };
    case 'transient':
      return retryOrGiveUp(ctx, outcome.error, outcome.status, outcome.retryAfterMs);
    case 'timeout':
      return isIdempotent(ctx.channel)
        ? retryOrGiveUp(ctx, outcome.error, null, null)
        : { ...base(), state: 'outcome_unknown', error: outcome.error };
  }
}

export const EXPIRED_LEASE_ERROR = 'The sender stopped before recording the result';

const TWILIO_STATES: Record<string, DeliveryState> = {
  delivered: 'delivered',
  completed: 'delivered',
  failed: 'failed_permanent',
  undelivered: 'failed_permanent',
  busy: 'failed_permanent',
  'no-answer': 'failed_permanent',
  canceled: 'failed_permanent',
};

/** Maps a provider status callback to a new state, or null when it must not change the row. */
export function callbackState(current: string, providerStatus: string): DeliveryState | null {
  const next = TWILIO_STATES[providerStatus];
  if (!next || FINAL_STATES.includes(current as DeliveryState)) return null;
  return next === current ? null : next;
}
