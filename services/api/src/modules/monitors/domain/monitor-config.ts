import {
  MONITOR_DEFAULTS,
  type MonitorKind,
  type MonitorSettings,
  type MonitorState,
} from '@ape/api-contracts';

export interface MonitorRuntime {
  paused: boolean;
  state: MonitorState;
  stateSince: string;
  failingSince: string | null;
  passingSince: string | null;
  version: number;
  leaseRunId: string | null;
  leaseUntil: string | null;
  nextCheckAt: string | null;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
  basicAuthSecretRef: string | null;
  badgeToken: string | null;
  sslExpiresAt: string | null;
  domainExpiresAt: string | null;
  sslAlerting: boolean;
  domainAlerting: boolean;
  nextExpiryCheckAt: string | null;
}

export type StoredSettings = Omit<MonitorSettings, 'kind' | 'name'>;

export type StoredMonitorConfig = StoredSettings &
  MonitorRuntime & { kind: 'monitor'; monitorKind: MonitorKind };

interface LegacyFields {
  expectedStatus?: number | null;
  confirmations?: number;
  failures?: number;
}

const RUNTIME_DEFAULTS: Omit<MonitorRuntime, 'stateSince'> = {
  paused: false,
  state: 'pending',
  failingSince: null,
  passingSince: null,
  version: 1,
  leaseRunId: null,
  leaseUntil: null,
  nextCheckAt: null,
  lastCheckedAt: null,
  lastStatusCode: null,
  lastResponseMs: null,
  lastError: null,
  basicAuthSecretRef: null,
  badgeToken: null,
  sslExpiresAt: null,
  domainExpiresAt: null,
  sslAlerting: false,
  domainAlerting: false,
  nextExpiryCheckAt: null,
};

export function readConfig(raw: unknown, createdAt: Date): StoredMonitorConfig {
  const c = raw as Partial<StoredMonitorConfig> & LegacyFields;
  const interval = c.intervalSeconds ?? MONITOR_DEFAULTS.intervalSeconds;
  // Rows written before time-based confirmation stored a failed-check count instead.
  const legacyConfirmation =
    c.confirmations !== undefined ? Math.max(0, c.confirmations - 1) * interval : undefined;
  return {
    ...MONITOR_DEFAULTS,
    ...RUNTIME_DEFAULTS,
    stateSince: createdAt.toISOString(),
    ...c,
    kind: 'monitor',
    monitorKind: c.monitorKind ?? 'http',
    expectedStatuses:
      c.expectedStatuses ??
      (c.expectedStatus ? [c.expectedStatus] : MONITOR_DEFAULTS.expectedStatuses),
    confirmationSeconds:
      c.confirmationSeconds ?? legacyConfirmation ?? MONITOR_DEFAULTS.confirmationSeconds,
    recoverySeconds:
      c.recoverySeconds ?? (c.confirmations !== undefined ? 0 : MONITOR_DEFAULTS.recoverySeconds),
  };
}

export function settingsOf(name: string, c: StoredMonitorConfig): MonitorSettings {
  const keys = Object.keys(MONITOR_DEFAULTS) as (keyof StoredSettings)[];
  const settings = Object.fromEntries(keys.map((k) => [k, c[k]])) as StoredSettings;
  return { ...settings, name, kind: c.monitorKind };
}

export function storedSettings(s: MonitorSettings): StoredSettings & { monitorKind: MonitorKind } {
  const keys = Object.keys(MONITOR_DEFAULTS) as (keyof StoredSettings)[];
  const settings = Object.fromEntries(keys.map((k) => [k, s[k]])) as StoredSettings;
  return { ...settings, monitorKind: s.kind };
}

export function targetLabel(c: StoredSettings & { monitorKind: MonitorKind }): string {
  if (c.url && ['http', 'keyword', 'status'].includes(c.monitorKind)) return c.url;
  if (c.monitorKind === 'dns') return `${c.dnsDomain} ${c.dnsRecordType} @${c.host}`;
  return c.port ? `${c.host}:${c.port}` : (c.host ?? '');
}
