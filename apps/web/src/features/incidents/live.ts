import {
  CLOSED_STATUSES,
  INCIDENT_TRANSITIONS,
  type Incident,
  type IncidentStatus,
  type TimelineEntry,
} from '@ape/api-contracts';

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'brand' | 'ai';

/** Plain-language label and badge tone for every status the API can return (FRD FR-05). */
export const STATUS_META: Record<IncidentStatus, { label: string; tone: Tone }> = {
  detected: { label: 'Detected', tone: 'danger' },
  investigating: { label: 'Investigating', tone: 'info' },
  fix_proposed: { label: 'Fix proposed', tone: 'ai' },
  validation: { label: 'Validating fix', tone: 'info' },
  validation_failed: { label: 'Validation failed', tone: 'danger' },
  awaiting_review: { label: 'Awaiting review', tone: 'warn' },
  monitoring: { label: 'Checking recovery', tone: 'brand' },
  verification_inconclusive: { label: 'Recovery unclear', tone: 'warn' },
  needs_attention: { label: 'Needs attention', tone: 'danger' },
  resolved: { label: 'Resolved', tone: 'ok' },
  closed_without_fix: { label: 'Closed without fix', tone: 'neutral' },
};

export const isClosed = (status: IncidentStatus) => CLOSED_STATUSES.includes(status);

/**
 * Statuses a person may move an incident to by hand. The backend validates every transition; the
 * steps the platform drives itself (validation, review, monitoring) are left to it.
 */
const MANUAL: readonly IncidentStatus[] = [
  'investigating',
  'needs_attention',
  'resolved',
  'closed_without_fix',
];
export function manualNextStatuses(status: IncidentStatus): IncidentStatus[] {
  return INCIDENT_TRANSITIONS[status].filter((s) => MANUAL.includes(s));
}

/** The logs to show for an incident: its service, from 15 minutes before it started to 5 after. */
export function incidentLogWindow(
  incident: Pick<Incident, 'serviceName' | 'firstSeenAt' | 'lastSeenAt'>,
): { q: string; from: string; to: string } | null {
  if (!incident.serviceName) return null;
  const from = new Date(Date.parse(incident.firstSeenAt) - 15 * 60_000).toISOString();
  const to = new Date(Date.parse(incident.lastSeenAt) + 5 * 60_000).toISOString();
  return { q: `service:${incident.serviceName}`, from, to };
}

/** A timeline row: one entry, or a run of the same error collapsed into one row with a count. */
export type TimelineRow = { entry: TimelineEntry; count: number; lastAt: string };

/**
 * Oldest first, with back-to-back errors that have the same summary folded into one row, so 499
 * identical errors read as one line with "×499" instead of burying the human and AI steps.
 */
export function groupTimeline(entries: TimelineEntry[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const e of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const prev = rows[rows.length - 1];
    if (
      prev &&
      e.kind === 'error' &&
      prev.entry.kind === 'error' &&
      prev.entry.summary === e.summary
    ) {
      prev.count += 1;
      prev.lastAt = e.at;
    } else rows.push({ entry: e, count: 1, lastAt: e.at });
  }
  return rows;
}
