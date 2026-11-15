import type { SimplePolicyInput } from '@ape/api-contracts';
import type { StoredBranch, StoredCondition, StoredStep } from '../../../core/db/schema';
import { meetsSeverity } from './severity';

export interface IncidentFacts {
  severity: string;
  attributes: Record<string, string | null>;
}

export const REPEAT_WAIT_MINUTES = 5;

function minutesInZone(now: Date, timezone: string): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  } catch {
    return null;
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** A window whose `to` is before `from` crosses midnight and belongs to the day it starts on. */
export function inTimeWindow(
  window: NonNullable<StoredCondition['timeWindow']>,
  now: Date,
): boolean {
  const local = minutesInZone(now, window.timezone);
  if (!local) return false;
  const from = toMinutes(window.from);
  const to = toMinutes(window.to);
  if (from <= to)
    return window.days.includes(local.day) && local.minutes >= from && local.minutes < to;
  if (local.minutes >= from) return window.days.includes(local.day);
  return local.minutes < to && window.days.includes((local.day + 6) % 7);
}

export function matchesCondition(when: StoredCondition, facts: IncidentFacts, now: Date): boolean {
  if (when.minSeverity && !meetsSeverity(facts.severity, when.minSeverity)) return false;
  for (const { key, value } of when.metadata ?? [])
    if ((facts.attributes[key] ?? '').toLowerCase() !== value.toLowerCase()) return false;
  if (when.timeWindow && !inTimeWindow(when.timeWindow, now)) return false;
  return true;
}

export function selectSteps(
  policy: { steps: StoredStep[]; branches: StoredBranch[] },
  facts: IncidentFacts,
  now: Date,
): { branch: string | null; steps: StoredStep[] } {
  const branch = policy.branches.find((b) => matchesCondition(b.when, facts, now));
  return branch
    ? { branch: branch.name, steps: branch.steps }
    : { branch: null, steps: policy.steps };
}

export function simplePolicySteps(input: SimplePolicyInput): StoredStep[] {
  const first: StoredStep = { waitMinutes: 0, targets: [input.primary], channels: input.channels };
  if (input.escalateAfterMinutes === null) return [first];
  return [
    first,
    {
      waitMinutes: input.escalateAfterMinutes,
      targets: [{ kind: 'everyone' }],
      channels: input.channels,
    },
  ];
}

export interface RunPosition {
  stepIndex: number;
  repeatsDone: number;
  repeatCount: number;
}

/** Where a run goes after the step at `run.stepIndex` was sent; null when the policy is exhausted. */
export function nextPosition(
  run: RunPosition,
  steps: StoredStep[],
): { stepIndex: number; repeatsDone: number; waitMinutes: number } | null {
  const next = steps[run.stepIndex + 1];
  if (next)
    return {
      stepIndex: run.stepIndex + 1,
      repeatsDone: run.repeatsDone,
      waitMinutes: next.waitMinutes,
    };
  if (run.repeatsDone >= run.repeatCount || steps.length === 0) return null;
  return {
    stepIndex: 0,
    repeatsDone: run.repeatsDone + 1,
    waitMinutes: Math.max(steps[0]!.waitMinutes, REPEAT_WAIT_MINUTES),
  };
}
