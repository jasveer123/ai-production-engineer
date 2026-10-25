import type { SeverityRule } from '@ape/api-contracts';

const FIELDS = ['environment', 'serviceName', 'errorType'] as const;

/** Trims each condition and drops empty ones: the API treats a missing field as "match anything". */
export function cleanRule(rule: SeverityRule): SeverityRule {
  const out: SeverityRule = { severity: rule.severity };
  for (const f of FIELDS) {
    const v = rule[f]?.trim();
    if (v) out[f] = v;
  }
  return out;
}

/** "production · checkout-api · TypeError", or "Any incident" when the rule has no conditions. */
export function describeRule(rule: SeverityRule): string {
  const parts = FIELDS.map((f) => rule[f]?.trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Any incident';
}

/** A copy of `list` with item `i` moved one place up (-1) or down (+1); unchanged at the edges. */
export function moveItem<T>(list: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
