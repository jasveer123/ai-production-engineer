import type { MonitorState } from '@ape/api-contracts';

export interface StateSnapshot {
  state: MonitorState;
  failingSince: string | null;
  passingSince: string | null;
}

export interface TransitionPolicy {
  intervalSeconds: number;
  confirmationSeconds: number;
  recoverySeconds: number;
  inMaintenance: boolean;
}

export interface Decision extends StateSnapshot {
  transition: 'down' | 'up' | null;
  nextDelaySeconds: number;
}

const MIN_RETRY_SECONDS = 5;

export function decideTransition(
  prev: StateSnapshot,
  ok: boolean,
  now: Date,
  policy: TransitionPolicy,
): Decision {
  const nowIso = now.toISOString();
  const elapsed = (since: string) => (now.getTime() - Date.parse(since)) / 1000;
  // While confirming or recovering we re-check sooner than the interval, like Better Stack.
  const retry = (remaining: number) =>
    Math.max(MIN_RETRY_SECONDS, Math.min(policy.intervalSeconds, Math.ceil(remaining)));
  const steady = { transition: null, nextDelaySeconds: policy.intervalSeconds } as const;

  if (ok) {
    if (prev.state !== 'down')
      return { state: 'up', failingSince: null, passingSince: null, ...steady };
    const passingSince = prev.passingSince ?? nowIso;
    const held = elapsed(passingSince);
    if (held >= policy.recoverySeconds)
      return {
        state: 'up',
        failingSince: null,
        passingSince: null,
        transition: 'up',
        nextDelaySeconds: policy.intervalSeconds,
      };
    return {
      state: 'down',
      failingSince: null,
      passingSince,
      transition: null,
      nextDelaySeconds: retry(policy.recoverySeconds - held),
    };
  }

  if (prev.state === 'down')
    return {
      state: 'down',
      failingSince: prev.failingSince ?? nowIso,
      passingSince: null,
      ...steady,
    };
  if (policy.inMaintenance)
    return { state: prev.state, failingSince: null, passingSince: null, ...steady };
  const failingSince = prev.failingSince ?? nowIso;
  const failed = elapsed(failingSince);
  if (failed >= policy.confirmationSeconds)
    return {
      state: 'down',
      failingSince,
      passingSince: null,
      transition: 'down',
      nextDelaySeconds: policy.intervalSeconds,
    };
  return {
    state: prev.state,
    failingSince,
    passingSince: null,
    transition: null,
    nextDelaySeconds: retry(policy.confirmationSeconds - failed),
  };
}
