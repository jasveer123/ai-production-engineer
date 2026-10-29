import {
  CLOSED_STATUSES,
  INCIDENT_TRANSITIONS,
  type IncidentStatus,
  type Severity,
  type SeverityRule,
} from '@ape/api-contracts';

export const canTransition = (from: IncidentStatus, to: IncidentStatus): boolean =>
  INCIDENT_TRANSITIONS[from].includes(to);

export const isClosed = (status: IncidentStatus): boolean => CLOSED_STATUSES.includes(status);

export const DEFAULT_SEVERITY_RULES: SeverityRule[] = [
  { environment: 'production', severity: 'high' },
  { severity: 'medium' },
];

export function severityFor(
  rules: SeverityRule[] | undefined,
  event: { environment: string; serviceName: string; errorType: string },
): Severity {
  for (const r of [...(rules ?? []), ...DEFAULT_SEVERITY_RULES]) {
    if (r.environment && r.environment !== event.environment) continue;
    if (r.serviceName && r.serviceName !== event.serviceName) continue;
    if (r.errorType && r.errorType !== event.errorType) continue;
    return r.severity;
  }
  return 'medium';
}
