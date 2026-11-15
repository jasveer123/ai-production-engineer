import type {
  Impact,
  MaintenancePhase,
  ManualState,
  OverallStatus,
  ResourceState,
} from '@ape/api-contracts';

export interface MonitorSnapshot {
  state?: string;
  paused?: boolean;
}

const RANK: Record<ResourceState, number> = {
  operational: 0,
  unknown: 1,
  maintenance: 2,
  degraded: 3,
  downtime: 4,
};

export function monitorState(monitor: MonitorSnapshot | undefined): ResourceState {
  if (!monitor || monitor.paused) return 'unknown';
  if (monitor.state === 'up') return 'operational';
  if (monitor.state === 'down') return 'downtime';
  return 'unknown';
}

export const worst = (states: ResourceState[]): ResourceState =>
  states.reduce<ResourceState>((a, b) => (RANK[b] > RANK[a] ? b : a), 'operational');

export interface ResourceInputs {
  manualState: ManualState | null;
  monitors: (MonitorSnapshot | undefined)[];
  inMaintenance: boolean;
  openImpacts: Impact[];
}

export function resourceState(input: ResourceInputs): ResourceState {
  if (input.inMaintenance) return 'maintenance';
  const reported = input.openImpacts.filter((i): i is 'degraded' | 'downtime' => i !== 'resolved');
  const base: ResourceState =
    input.monitors.length > 0
      ? worst(input.monitors.map(monitorState))
      : (input.manualState ?? 'operational');
  return worst([base, ...reported]);
}

export function overallStatus(states: ResourceState[]): OverallStatus {
  if (states.length === 0) return 'operational';
  const down = states.filter((s) => s === 'downtime').length;
  if (down === states.length) return 'outage';
  if (down > 0 || states.includes('degraded')) return 'degraded';
  if (states.includes('maintenance')) return 'maintenance';
  if (states.every((s) => s === 'unknown')) return 'unknown';
  return 'operational';
}

export function maintenancePhase(startsAt: Date, endsAt: Date, now: Date): MaintenancePhase {
  if (now < startsAt) return 'upcoming';
  if (now < endsAt) return 'in_progress';
  return 'completed';
}

export const transitionKey = (monitorId: string, state: string, since: string) =>
  `monitor:${monitorId}:${state}:${since}`;

export interface MailOutcome {
  ok: boolean;
  error: string | null;
}

export function mailOutcome(result: unknown): MailOutcome {
  if (result === undefined || result === null) return { ok: true, error: null };
  if (typeof result !== 'object') return { ok: true, error: null };
  const r = result as {
    ok?: unknown;
    state?: unknown;
    status?: unknown;
    error?: unknown;
    reason?: unknown;
  };
  if (r.state === 'not_configured') return { ok: false, error: 'No mail transport is configured' };
  const failed =
    r.ok === false || r.state === 'failed' || r.status === 'failed' || r.status === 'error';
  if (!failed) return { ok: true, error: null };
  const detail = r.error ?? r.reason;
  return { ok: false, error: typeof detail === 'string' ? detail : 'Delivery failed' };
}
