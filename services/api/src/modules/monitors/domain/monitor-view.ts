import type { MonitorView } from '@ape/api-contracts';
import { inMaintenance } from './maintenance';
import { readConfig, settingsOf } from './monitor-config';

interface MonitorRowLike {
  id: string;
  name: string;
  config: unknown;
  createdAt: Date;
}

export function toMonitorView(
  row: MonitorRowLike,
  uptime24h: number | null,
  now = new Date(),
): MonitorView {
  const c = readConfig(row.config, row.createdAt);
  return {
    ...settingsOf(row.name, c),
    id: row.id,
    hasBasicAuthPassword: Boolean(c.basicAuthSecretRef),
    paused: c.paused,
    inMaintenance: inMaintenance(c.maintenance, now),
    state: c.state,
    stateSince: c.stateSince,
    version: c.version,
    lastCheckedAt: c.lastCheckedAt,
    lastStatusCode: c.lastStatusCode,
    lastResponseMs: c.lastResponseMs,
    lastError: c.lastError,
    nextCheckAt: c.paused ? null : c.nextCheckAt,
    sslExpiresAt: c.sslExpiresAt,
    domainExpiresAt: c.domainExpiresAt,
    uptime24h,
    createdAt: row.createdAt.toISOString(),
  };
}
