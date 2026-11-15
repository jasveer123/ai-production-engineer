import type { FunnelStep, FunnelUnit } from '@ape/api-contracts';

export interface FunnelEvent {
  sessionId: string;
  userId?: string | null;
  ts: number;
  seq: number;
  type: string;
  name: string;
  url: string | null;
}

export interface FunnelOptions {
  unit: FunnelUnit;
  windowMs: number | null;
}

const MAX_STARTS = 50;

export function matches(step: FunnelStep, e: FunnelEvent): boolean {
  if (step.kind === 'event') return e.type !== 'pageview' && e.name === step.match;
  if (e.type !== 'pageview' || !e.url) return false;
  const path = e.url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0] ?? '';
  return step.match.endsWith('*') ? path.startsWith(step.match.slice(0, -1)) : path === step.match;
}

function depthFrom(
  steps: FunnelStep[],
  list: FunnelEvent[],
  start: number,
  windowMs: number | null,
) {
  const startTs = list[start]!.ts;
  let at = start;
  let depth = 1;
  for (let i = 1; i < steps.length; i++) {
    let next = -1;
    for (let j = at + 1; j < list.length; j++) {
      if (windowMs !== null && list[j]!.ts - startTs > windowMs) break;
      if (matches(steps[i]!, list[j]!)) {
        next = j;
        break;
      }
    }
    if (next < 0) break;
    at = next;
    depth++;
  }
  return depth;
}

export function reachedPerStep(
  steps: FunnelStep[],
  events: FunnelEvent[],
  options: FunnelOptions = { unit: 'session', windowMs: null },
): number[] {
  const groups = new Map<string, FunnelEvent[]>();
  for (const e of events) {
    const key = options.unit === 'user' && e.userId ? `u:${e.userId}` : `s:${e.sessionId}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const reached = steps.map(() => 0);
  for (const list of groups.values()) {
    list.sort((a, b) => a.ts - b.ts || a.seq - b.seq);
    let best = 0;
    let starts = 0;
    for (let s = 0; s < list.length && starts < MAX_STARTS && best < steps.length; s++) {
      if (!matches(steps[0]!, list[s]!)) continue;
      starts++;
      best = Math.max(best, depthFrom(steps, list, s, options.windowMs));
    }
    for (let i = 0; i < best; i++) reached[i]! += 1;
  }
  return reached;
}
