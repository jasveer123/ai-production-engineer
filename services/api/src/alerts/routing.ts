import { createHash } from 'node:crypto';
import type { AlertCondition } from '../db/schema';
import type { ParsedAlert } from './parsers';

export interface RouteLike {
  id: string;
  enabled: boolean;
  position: number;
  sourceIds: string[];
  conditions: AlertCondition[];
  groupBy: string[];
}

const MAX_REGEX_LENGTH = 200;

/** The value a condition looks at: a top-level field or `label.<name>`. */
export function fieldValue(a: ParsedAlert, field: string): string | undefined {
  if (field.startsWith('label.')) return a.labels[field.slice(6)];
  if (field === 'title') return a.title;
  if (field === 'description') return a.description ?? undefined;
  if (field === 'severity') return a.severity;
  if (field === 'status') return a.status;
  return undefined;
}

export function conditionMatches(a: ParsedAlert, c: AlertCondition): boolean {
  const v = fieldValue(a, c.field);
  const want = c.value ?? '';
  switch (c.op) {
    case 'exists':
      return v !== undefined && v !== '';
    case 'not_exists':
      return v === undefined || v === '';
    case 'eq':
      return v?.toLowerCase() === want.toLowerCase();
    case 'neq':
      return v?.toLowerCase() !== want.toLowerCase();
    case 'contains':
      return !!v && v.toLowerCase().includes(want.toLowerCase());
    case 'not_contains':
      return !v || !v.toLowerCase().includes(want.toLowerCase());
    case 'regex':
      // Bounded patterns only (validated on save too); an invalid one never matches.
      if (want.length > MAX_REGEX_LENGTH) return false;
      try {
        return v !== undefined && new RegExp(want, 'i').test(v);
      } catch {
        return false;
      }
  }
}

/** First enabled route (by position) whose sources and conditions all match. */
export function matchRoute<R extends RouteLike>(
  routes: R[],
  sourceId: string,
  alert: ParsedAlert,
): R | null {
  return (
    [...routes]
      .filter((r) => r.enabled)
      .sort((x, y) => x.position - y.position)
      .find(
        (r) =>
          (r.sourceIds.length === 0 || r.sourceIds.includes(sourceId)) &&
          r.conditions.every((c) => conditionMatches(alert, c)),
      ) ?? null
  );
}

/**
 * Alerts with the same values for the route's `groupBy` labels share one incident. Without
 * grouping labels each distinct alert gets its own group (by source and dedup key).
 */
export function groupKey(route: RouteLike, sourceId: string, alert: ParsedAlert): string {
  const parts = route.groupBy.length
    ? route.groupBy.map(
        (f) =>
          `${f}=${fieldValue(alert, f.includes('.') || ['title', 'severity'].includes(f) ? f : `label.${f}`) ?? ''}`,
      )
    : [`source=${sourceId}`, `alert=${alert.dedupKey}`];
  return parts.join('|');
}

/** Incident fingerprint for a group: open incidents are unique per fingerprint. */
export const groupFingerprint = (routeId: string, key: string) =>
  `alert:${routeId}:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;

/** Human-readable reason, shown on the alert, for why it joined an incident. */
export function groupReason(route: { name: string; groupBy: string[] }, key: string): string {
  return route.groupBy.length
    ? `Grouped by route "${route.name}" on ${key.replace(/\|/g, ', ')}`
    : `Routed by "${route.name}"`;
}
