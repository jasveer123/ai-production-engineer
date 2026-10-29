import { INCIDENTS } from './fixtures';
import type { Incident, IncidentStatus, Severity } from './types';

export function listIncidents(): Incident[] {
  return [...INCIDENTS].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function getIncident(id: string): Incident | undefined {
  return INCIDENTS.find((incident) => incident.id === id);
}

const CLOSED: IncidentStatus[] = ['resolved'];

export function isOpen(incident: Incident): boolean {
  return !CLOSED.includes(incident.status);
}

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: 'Investigating',
  awaiting_approval: 'Needs your approval',
  fix_ready: 'Fix ready',
  pr_open: 'PR open',
  verifying: 'Checking recovery',
  resolved: 'Resolved',
  needs_attention: 'Needs attention',
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];
