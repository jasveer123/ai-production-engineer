import { TRAFFIC_COUNT_CAP } from '@ape/api-contracts';
import type { RecoveryOutcome } from '@ape/temporal-workflows';

export interface RecoveryThresholds {
  /** This many errors with the incident's fingerprint after the deploy means not recovered. */
  minErrors: number;
  /** Zero errors over at least this many requests is a recovery. */
  minRequests: number;
  /**
   * Without traffic data, zero errors is still a recovery when the pre-fix rate predicted at
   * least this many: P(0 | Poisson(5)) is under 1%.
   */
  minExpectedErrors: number;
}

export const DEFAULT_MIN_EXPECTED_ERRORS = 5;

export interface RecoveryInput {
  errors: number;
  /** Requests to the failing operation in the window; null when traffic is unknown. */
  requests: number | null;
  expectedErrors: number;
  /** Interim checks only ever conclude "not recovered"; the rest waits for the window to end. */
  interim: boolean;
}

export interface RecoveryDecision {
  outcome: RecoveryOutcome | 'pending';
  reason: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const requestsText = (n: number) =>
  n >= TRAFFIC_COUNT_CAP ? `at least ${TRAFFIC_COUNT_CAP} requests` : plural(n, 'request');

/**
 * Decides whether the incident recovered after the fix deploy. Deliberately conservative: a
 * recovery needs evidence (traffic, or a pre-fix rate that should have produced errors), and any
 * repeat of the same error below the threshold is left to a human as inconclusive.
 */
export function decideRecovery(input: RecoveryInput, t: RecoveryThresholds): RecoveryDecision {
  const { errors, requests, expectedErrors } = input;
  if (errors >= t.minErrors) {
    return {
      outcome: 'not_recovered',
      reason: `${plural(errors, 'error')} with the same fingerprint after the fix was deployed`,
    };
  }
  if (input.interim) return { outcome: 'pending', reason: 'Observation window still open' };

  if (errors === 0 && requests !== null && requests >= t.minRequests) {
    return {
      outcome: 'recovered',
      reason: `No errors across ${requestsText(requests)} to the failing operation`,
    };
  }
  if (errors === 0 && expectedErrors >= t.minExpectedErrors) {
    return {
      outcome: 'recovered',
      reason: `No errors where about ${Math.round(expectedErrors)} were expected at the pre-fix rate`,
    };
  }
  if (errors > 0) {
    return {
      outcome: 'inconclusive',
      reason: `${plural(errors, 'error')} with the same fingerprint after the deploy (below the threshold of ${t.minErrors})`,
    };
  }
  const traffic =
    requests === null
      ? 'traffic is unknown (no connected Jaeger integration or it failed)'
      : `only ${plural(requests, 'request')} (need ${t.minRequests})`;
  return {
    outcome: 'inconclusive',
    reason: `No errors, but not enough evidence of recovery: ${traffic}, and the pre-fix rate predicted ${expectedErrors.toFixed(1)} errors`,
  };
}

/** Errors the pre-fix rate predicts for a window of `durationMs`. */
export const expectedErrors = (baselinePerHour: number, durationMs: number): number =>
  Math.round(((baselinePerHour * durationMs) / 3_600_000) * 10) / 10;

/** Short and full SHAs name the same commit when one is a prefix of the other. */
export const sameCommit = (a: string, b: string): boolean => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.length >= 7 && y.length >= 7 && (x.startsWith(y) || y.startsWith(x));
};
