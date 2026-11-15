import type { HealthCheck, HealthLevel } from '@ape/api-contracts';

export const CRITICAL_CHECKS = new Set(['database']);

export function overallStatus(checks: HealthCheck[]): HealthLevel {
  if (checks.some((c) => c.status === 'down' && CRITICAL_CHECKS.has(c.name))) return 'down';
  return checks.every((c) => c.status === 'ok') ? 'ok' : 'degraded';
}

export function freshness(
  name: string,
  beatAt: Date | null,
  now: Date,
  maxAgeMs: number,
): HealthCheck {
  if (!beatAt) return { name, status: 'down', latencyMs: null, detail: 'Never reported' };
  const age = now.getTime() - beatAt.getTime();
  return age <= maxAgeMs
    ? { name, status: 'ok', latencyMs: null, detail: `Last beat ${Math.round(age / 1000)} s ago` }
    : {
        name,
        status: 'down',
        latencyMs: null,
        detail: `Stale: last beat ${Math.round(age / 1000)} s ago`,
      };
}

export function lag(name: string, oldest: Date | null, now: Date, maxLagMs: number): HealthCheck {
  if (!oldest) return { name, status: 'ok', latencyMs: null, detail: 'Nothing waiting' };
  const age = now.getTime() - oldest.getTime();
  return {
    name,
    status: age > maxLagMs ? 'degraded' : 'ok',
    latencyMs: null,
    detail: `Oldest waiting item is ${Math.round(age / 1000)} s old`,
  };
}
