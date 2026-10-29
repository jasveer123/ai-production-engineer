import { TRAFFIC_COUNT_CAP } from '@ape/api-contracts';
import type { RecoveryOutcome } from '@ape/temporal-workflows';

export interface RecoveryThresholds {
  minErrors: number;

  minRequests: number;

  minExpectedErrors: number;
}

export const DEFAULT_MIN_EXPECTED_ERRORS = 5;

export interface RecoveryInput {
  errors: number;

  requests: number | null;
  expectedErrors: number;

  interim: boolean;
}

export interface RecoveryDecision {
  outcome: RecoveryOutcome | 'pending';
  reason: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const requestsText = (n: number) =>
  n >= TRAFFIC_COUNT_CAP ? `at least ${TRAFFIC_COUNT_CAP} requests` : plural(n, 'request');

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

export const expectedErrors = (baselinePerHour: number, durationMs: number): number =>
  Math.round(((baselinePerHour * durationMs) / 3_600_000) * 10) / 10;

export const sameCommit = (a: string, b: string): boolean => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.length >= 7 && y.length >= 7 && (x.startsWith(y) || y.startsWith(x));
};
