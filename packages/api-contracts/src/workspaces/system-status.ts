import type { IsoTimestamp } from '../common';

export const HEALTH_LEVELS = ['ok', 'degraded', 'down'] as const;
export type HealthLevel = (typeof HEALTH_LEVELS)[number];

export interface HealthCheck {
  name: string;
  status: HealthLevel;
  latencyMs: number | null;
  detail: string | null;
}

export interface SystemStatus {
  status: HealthLevel;
  checkedAt: IsoTimestamp;
  checks: HealthCheck[];
}
