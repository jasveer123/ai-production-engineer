import { createHash } from 'node:crypto';
import type { AlertCondition } from '../../../core/db/schema';
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

export function fieldValue(a: ParsedAlert, field: string): string | undefined {
  if (field.startsWith('label.')) return a.labels[field.slice(6)];
  if (field === 'title') return a.title;
  if (field === 'description') return a.description ?? undefined;
  if (field === 'severity') return a.severity;
  if (field === 'status') return a.status;
  return undefined;
}

const lower = (s: string | undefined) => s?.toLowerCase();

function regexMatches(v: string | undefined, pattern: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) return false;
  try {
    return v !== undefined && new RegExp(pattern, 'i').test(v);
  } catch {
    return false;
  }
}

const OPERATORS: Record<AlertCondition['op'], (v: string | undefined, want: string) => boolean> = {
  exists: (v) => v !== undefined && v !== '',
  not_exists: (v) => v === undefined || v === '',
  eq: (v, want) => lower(v) === want.toLowerCase(),
  neq: (v, want) => lower(v) !== want.toLowerCase(),
  contains: (v, want) => !!v && v.toLowerCase().includes(want.toLowerCase()),
  not_contains: (v, want) => !v || !v.toLowerCase().includes(want.toLowerCase()),
  regex: regexMatches,
};

export function conditionMatches(a: ParsedAlert, c: AlertCondition): boolean {
  return OPERATORS[c.op](fieldValue(a, c.field), c.value ?? '');
}

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

export function groupKey(route: RouteLike, sourceId: string, alert: ParsedAlert): string {
  const parts = route.groupBy.length
    ? route.groupBy.map(
        (f) =>
          `${f}=${fieldValue(alert, f.includes('.') || ['title', 'severity'].includes(f) ? f : `label.${f}`) ?? ''}`,
      )
    : [`source=${sourceId}`, `alert=${alert.dedupKey}`];
  return parts.join('|');
}

export const groupFingerprint = (routeId: string, key: string) =>
  `alert:${routeId}:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;

export function groupReason(route: { name: string; groupBy: string[] }, key: string): string {
  return route.groupBy.length
    ? `Grouped by route "${route.name}" on ${key.replace(/\|/g, ', ')}`
    : `Routed by "${route.name}"`;
}
