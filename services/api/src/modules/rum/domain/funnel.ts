import type { FunnelStep } from '@ape/api-contracts';

export interface FunnelEvent {
  sessionId: string;
  ts: number;
  type: string;
  name: string;
  url: string | null;
}

export function matches(step: FunnelStep, e: FunnelEvent): boolean {
  if (step.kind === 'event') return e.type !== 'pageview' && e.name === step.match;
  if (e.type !== 'pageview' || !e.url) return false;
  const path = e.url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0] ?? '';
  return step.match.endsWith('*') ? path.startsWith(step.match.slice(0, -1)) : path === step.match;
}

export function reachedPerStep(steps: FunnelStep[], events: FunnelEvent[]): number[] {
  const bySession = new Map<string, FunnelEvent[]>();
  for (const e of events) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
  }
  const reached = steps.map(() => 0);
  for (const list of bySession.values()) {
    list.sort((a, b) => a.ts - b.ts);
    let from = -Infinity;
    for (let i = 0; i < steps.length; i++) {
      const hit = list.find((e) => e.ts >= from && matches(steps[i]!, e));
      if (!hit) break;
      reached[i]! += 1;
      from = hit.ts;
    }
  }
  return reached;
}
